// Állapot, betöltés, mentés, ütközéskezelés, tervező mód kapcsoló.

import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { ATTACHMENTS_FIELD } from '../engine/Attachments';
import { isEmptyValue } from '../engine/ConditionEngine';
import { format } from '../engine/EngineStrings';
import {
  createDefaultConfig,
  flattenFields,
  getInitialValues,
  IResolvedField,
  IResolvedForm,
  resolveForm
} from '../engine/LayoutResolver';
import { FieldErrors, FormValues, IFieldSchema } from '../models/IFieldSchema';
import { FormMode, IFormConfig } from '../models/IFormConfig';
import * as AttachmentService from '../services/AttachmentService';
import * as ConfigService from '../services/ConfigService';
import * as ItemService from '../services/ItemService';
import * as PermissionService from '../services/PermissionService';
import * as SchemaService from '../services/SchemaService';
import { DesignerPanel, DesignerTab } from './DesignerPanel';
import { EMPTY_ATTACHMENTS, FormContext, IAttachmentsState, IFormContext } from './FormContext';
import { FormRenderer } from './FormRenderer';

const TEXT = {
  loading: strings.Loading,
  loadFailed: strings.LoadFailed,
  save: strings.Save,
  saving: strings.Saving,
  cancel: strings.Cancel,
  close: strings.Close,
  required: strings.RequiredField,
  saveFailed: strings.SaveFailed,
  designer: strings.Designer,
  designerSave: strings.DesignerSave,
  designerNotice: strings.DesignerNotice,
  previewMode: strings.PreviewMode,
  missingFields: strings.MissingFields,
  configConflict: strings.ConfigConflict,
  configDenied: strings.ConfigDenied,
  configSaveFailed: strings.ConfigSaveFailed,
  conflictTitle: strings.ConflictTitle,
  conflictText: strings.ConflictText,
  overwrite: strings.Overwrite,
  reload: strings.Reload
};

const PREVIEW_OPTIONS: IDropdownOption[] = [
  { key: 'new', text: strings.ModeNew },
  { key: 'edit', text: strings.ModeEdit },
  { key: 'display', text: strings.ModeDisplay }
];

const DEFAULT_FORM_WIDTH: number = 960;
const DESIGNER_MIN_HEIGHT: number = 480;

const classes = mergeStyleSets({
  root: { padding: '16px 24px 24px', boxSizing: 'border-box' },
  narrow: { maxWidth: DEFAULT_FORM_WIDTH },
  header: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
  title: { flex: 1, margin: 0, fontSize: 24, fontWeight: 600 },
  messages: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  // Tervező mód: a sor (és így az oldal) magasságát az előnézet adja. A tervező panel tartalma
  // abszolút pozícionált, ezért nem növeli a sort, hanem a form magasságához igazodva görgethető.
  designLayout: { display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' },
  preview: { flex: '1 1 480px', minWidth: 0 },
  panel: {
    flex: '0 1 400px',
    minWidth: 300,
    // Rövid formnál (vagy keskeny képernyőn, a form alá tördelve) is maradjon használható magasság.
    minHeight: DESIGNER_MIN_HEIGHT,
    position: 'relative',
    borderLeft: '1px solid #edebe9'
  },
  panelInner: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: 24
  },
  panelScroll: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8 },
  panelActions: { display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #edebe9' },
  actions: { display: 'flex', gap: 8, marginTop: 8 }
});

export interface IFormHostProps {
  mode: FormMode;
  listId: string;
  listTitle: string;
  /** Új elem célmappájának szerverrelatív útvonala. */
  folderPath: string;
  itemId?: number;
  contentTypeId?: string;
  /** A web területi beállításainak kultúrája (dátumformátum). */
  cultureName: string;
  /** A felület nyelve. */
  uiCultureName: string;
  onSaved: () => void;
  onClosed: () => void;
}

interface ILoaded {
  schema: IFieldSchema[];
  contentTypeId: string;
  /** A mentett elrendezés (vagy az alapértelmezett, ha nincs mentett). */
  config: IFormConfig;
  configRef: ConfigService.IConfigRef;
  configWarning?: string;
  /** A betöltéskori form-string értékek; a módosulás vizsgálatának alapja. */
  original: FormValues;
  displayValues: FormValues;
  modified?: string;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback;
}

export const FormHost: React.FC<IFormHostProps> = (props) => {
  const { mode, listId, itemId } = props;

  const [loaded, setLoaded] = React.useState<ILoaded | undefined>();
  const [loadError, setLoadError] = React.useState<string | undefined>();
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [values, setValues] = React.useState<FormValues>({});
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [topErrors, setTopErrors] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [conflict, setConflict] = React.useState<boolean>(false);
  const [attachments, setAttachments] = React.useState<IAttachmentsState>(EMPTY_ATTACHMENTS);
  // Az elem mentése sikerült, de egyes mellékletek művelete nem: a Mentés már csak a mellékleteket próbálja újra.
  const [attachmentRetryId, setAttachmentRetryId] = React.useState<number | undefined>();

  // Tervező: a draft a konfiguráció mély másolata; a mégse egyszerűen eldobja.
  const [draft, setDraft] = React.useState<IFormConfig | undefined>();
  const [previewMode, setPreviewMode] = React.useState<FormMode>(mode);
  const [designerTab, setDesignerTab] = React.useState<DesignerTab>('layout');
  const [selectedField, setSelectedField] = React.useState<string | undefined>();
  const [designError, setDesignError] = React.useState<string | undefined>();

  const load = React.useCallback(async (): Promise<void> => {
    setLoaded(undefined);
    setLoadError(undefined);
    setErrors({});
    setTopErrors([]);
    try {
      // Edit/Display módban az elem tartalomtípusa az irányadó, ha a kontextus nem adja meg.
      const itemPromise: Promise<ItemService.IItemData | undefined> =
        mode !== 'new' && itemId !== undefined ? ItemService.load(listId, itemId) : Promise.resolve(undefined);
      let contentTypeId: string | undefined = props.contentTypeId;
      if (!contentTypeId && mode !== 'new') {
        contentTypeId = (await itemPromise)?.contentTypeId;
      }
      const resolvedContentTypeId: string = await SchemaService.resolveContentTypeId(listId, contentTypeId);

      const [schema, configResult, item] = await Promise.all([
        SchemaService.getFields(listId, resolvedContentTypeId),
        ConfigService.load(listId, resolvedContentTypeId),
        itemPromise
      ]);

      const config: IFormConfig =
        configResult.config ?? createDefaultConfig(listId, resolvedContentTypeId, schema);
      let original: FormValues = item ? item.values : {};
      // A személy mezők visszaírható értékét külön kell lekérdezni.
      const userFields: string[] = schema
        .filter((field) => field.TypeAsString === 'User' || field.TypeAsString === 'UserMulti')
        .map((field) => field.InternalName);
      if (item && itemId !== undefined && userFields.length > 0) {
        original = { ...original, ...(await ItemService.loadUserValues(listId, itemId, userFields)) };
      }
      // A keresőmezőknél ugyanígy: a hivatkozott elemek azonosítóját külön kérdezzük le.
      const lookupFields: ItemService.ILookupFieldRef[] = schema
        .filter((field) => field.LookupListId !== undefined)
        .map((field) => ({ name: field.InternalName, multiple: field.TypeAsString === 'LookupMulti' }));
      if (item && itemId !== undefined && lookupFields.length > 0) {
        original = { ...original, ...(await ItemService.loadLookupValues(listId, itemId, lookupFields)) };
      }
      // Hivatkozás mezők: a cím és a leírás külön lekérdezésből.
      const urlFields: string[] = schema.filter((field) => field.TypeAsString === 'URL').map((field) => field.InternalName);
      if (item && itemId !== undefined && urlFields.length > 0) {
        original = { ...original, ...(await ItemService.loadUrlValues(listId, itemId, urlFields)) };
      }
      // Hely mezők: a helyobjektum JSON-ja külön lekérdezésből.
      const locationFields: string[] = schema
        .filter((field) => field.TypeAsString === 'Location')
        .map((field) => field.InternalName);
      if (item && itemId !== undefined && locationFields.length > 0) {
        original = { ...original, ...(await ItemService.loadLocationValues(listId, itemId, locationFields)) };
      }

      const hasAttachments: boolean = schema.some((field) => field.TypeAsString === ATTACHMENTS_FIELD);
      const existing: AttachmentService.IAttachmentFile[] =
        item && itemId !== undefined && hasAttachments
          ? await AttachmentService.list(listId, itemId).catch(() => [])
          : [];
      setAttachments({ existing, added: [], removed: [] });
      setAttachmentRetryId(undefined);

      setValues(item ? original : getInitialValues(schema, config, props.cultureName));
      setLoaded({
        schema,
        contentTypeId: resolvedContentTypeId,
        config,
        configRef: { itemId: configResult.itemId, etag: configResult.etag },
        configWarning: configResult.warning,
        original,
        displayValues: item ? item.displayValues : {},
        modified: item?.modified
      });
    } catch (e) {
      setLoadError(errorText(e, TEXT.loadFailed));
    }
  }, [mode, listId, itemId, props.contentTypeId, props.cultureName]);

  React.useEffect(() => {
    load().catch(() => undefined);
    PermissionService.isAdmin()
      .then(setIsAdmin)
      .catch(() => undefined);
  }, [load]);

  const activeMode: FormMode = draft ? previewMode : mode;
  const activeConfig: IFormConfig | undefined = draft ?? loaded?.config;

  // Minden értékváltozáskor újraszámoljuk a feltételeket. Olcsó művelet; ne kerüljön bele aszinkron hívás.
  const resolved: IResolvedForm | undefined = React.useMemo(
    () => (loaded && activeConfig ? resolveForm(loaded.schema, activeConfig, activeMode, values) : undefined),
    [loaded, activeConfig, activeMode, values]
  );

  // A FieldValuesAsText szöveg csak addig érvényes, amíg az érték nem változott a betöltés óta.
  const displayValues: FormValues = React.useMemo(() => {
    const result: FormValues = {};
    if (loaded) {
      Object.keys(loaded.displayValues).forEach((name) => {
        if ((values[name] ?? '') === (loaded.original[name] ?? '')) {
          result[name] = loaded.displayValues[name];
        }
      });
    }
    return result;
  }, [loaded, values]);

  const formContext: IFormContext = React.useMemo(
    () => ({
      cultureName: props.cultureName,
      uiCultureName: props.uiCultureName,
      itemId: mode === 'new' ? undefined : itemId,
      sourceValues: loaded?.original ?? {},
      attachments,
      setAttachments
    }),
    [props.cultureName, props.uiCultureName, mode, itemId, loaded, attachments]
  );

  const onFieldChange = React.useCallback((name: string, value: string): void => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) {
        return current;
      }
      const next: FieldErrors = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  /** A mellékletek törlése és feltöltése a mentett elemhez. Hamis, ha valamelyik művelet nem sikerült. */
  const syncAttachments = async (targetId: number): Promise<boolean> => {
    if (attachments.added.length === 0 && attachments.removed.length === 0) {
      return true;
    }
    const result = await AttachmentService.sync(listId, targetId, attachments.removed, attachments.added);
    const uploadedNames: string[] = result.uploaded.map((file) => file.name);
    // A sikeres műveletek kikerülnek a függőben lévők közül, így újrapróbálásnál csak a sikertelenek futnak.
    setAttachments({
      existing: attachments.existing.filter((file) => result.deleted.indexOf(file.name) === -1).concat(result.uploaded),
      added: attachments.added.filter((file) => uploadedNames.indexOf(file.name) === -1),
      removed: attachments.removed.filter((name) => result.deleted.indexOf(name) === -1)
    });
    if (result.failed.length > 0) {
      setAttachmentRetryId(targetId);
      setTopErrors([format(strings.AttachmentsFailed, result.failed.join(', '))]);
      return false;
    }
    return true;
  };

  const save = async (overwrite: boolean): Promise<void> => {
    if (!loaded || !resolved || mode === 'display') {
      return;
    }
    // Az elem már mentve van, csak a sikertelen mellékleteket próbáljuk újra (új elemnél így nem jön létre másolat).
    if (attachmentRetryId !== undefined) {
      setSaving(true);
      setTopErrors([]);
      try {
        if (await syncAttachments(attachmentRetryId)) {
          props.onSaved();
        }
      } catch (e) {
        setTopErrors([errorText(e, TEXT.saveFailed)]);
      } finally {
        setSaving(false);
      }
      return;
    }
    const visibleFields: IResolvedField[] = flattenFields(resolved).filter((field) => field.visible);
    const editableFields: IResolvedField[] = visibleFields.filter((field) => !field.readOnly);

    // 1. Kliens oldali ellenőrzés: a látható, kötelező mezők nem lehetnek üresek.
    const validationErrors: FieldErrors = {};
    editableFields.forEach((field) => {
      const empty: boolean =
        field.schema.TypeAsString === ATTACHMENTS_FIELD
          ? attachments.existing.length - attachments.removed.length + attachments.added.length === 0
          : isEmptyValue(values[field.name]);
      if (field.required && empty) {
        validationErrors[field.name] = TEXT.required;
      }
    });
    setTopErrors([]);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // 2. Csak a látható, szerkeszthető és módosult mezők kerülnek a mentésbe.
    //    Rejtett mező értékét soha nem küldjük el, mert felülírná a szerveroldali értéket.
    const changed: FormValues = {};
    //    A mellékletek nem mezőérték: külön, az elem mentése után kerülnek fel.
    editableFields.forEach((field) => {
      if (field.schema.TypeAsString === ATTACHMENTS_FIELD) {
        return;
      }
      const current: string = values[field.name] ?? '';
      if (current !== (loaded.original[field.name] ?? '')) {
        changed[field.name] = current;
      }
    });
    const attachmentsEditable: boolean = editableFields.some((field) => field.schema.TypeAsString === ATTACHMENTS_FIELD);
    const attachmentsChanged: boolean =
      attachmentsEditable && (attachments.added.length > 0 || attachments.removed.length > 0);
    const fieldsChanged: boolean = Object.keys(changed).length > 0;
    if (mode === 'edit' && !fieldsChanged && !attachmentsChanged) {
      props.onClosed();
      return;
    }

    setSaving(true);
    try {
      // 3. Ütközésvizsgálat Edit módban.
      if (mode === 'edit' && itemId !== undefined && !overwrite && fieldsChanged) {
        const currentModified: string = await ItemService.getModified(listId, itemId);
        if (currentModified !== loaded.modified) {
          setConflict(true);
          return;
        }
      }

      // 4. Mentés. Szerkesztésnél, ha csak a mellékletek változtak, az elemet nem írjuk.
      const result: ItemService.ISaveResult =
        mode === 'edit' && !fieldsChanged
          ? { itemId, errors: {} }
          : await ItemService.save(
              {
                listId,
                itemId: mode === 'edit' ? itemId : undefined,
                contentTypeId: loaded.contentTypeId,
                folderPath: props.folderPath
              },
              changed
            );

      // 5. Mezőnkénti hibák a mezők alá, a nem látható mezők hibái a felső üzenetsávba.
      const failed: string[] = Object.keys(result.errors);
      if (failed.length > 0) {
        const fieldErrors: FieldErrors = {};
        const otherErrors: string[] = [];
        failed.forEach((name) => {
          if (visibleFields.some((field) => field.name === name)) {
            fieldErrors[name] = result.errors[name];
          } else {
            otherErrors.push(`${name}: ${result.errors[name]}`);
          }
        });
        setErrors(fieldErrors);
        setTopErrors(otherErrors);
        return;
      }

      // 6. Mellékletek a mentett elemhez. Hiba esetén a form nyitva marad, és a Mentés csak ezt próbálja újra.
      if (attachmentsChanged) {
        if (result.itemId === undefined) {
          setTopErrors([format(strings.AttachmentsFailed, attachments.added.map((file) => file.name).join(', '))]);
          return;
        }
        if (!(await syncAttachments(result.itemId))) {
          return;
        }
      }
      props.onSaved();
    } catch (e) {
      setTopErrors([errorText(e, TEXT.saveFailed)]);
    } finally {
      setSaving(false);
    }
  };

  const startDesign = (): void => {
    if (!loaded) {
      return;
    }
    setDraft(JSON.parse(JSON.stringify(loaded.config)) as IFormConfig);
    setPreviewMode(mode);
    setDesignerTab('layout');
    setSelectedField(undefined);
    setDesignError(undefined);
  };

  const cancelDesign = (): void => {
    setDraft(undefined);
    setDesignError(undefined);
  };

  const saveDesign = async (): Promise<void> => {
    if (!loaded || !draft) {
      return;
    }
    const config: IFormConfig = { ...draft, listId, contentTypeId: loaded.contentTypeId };
    setSaving(true);
    setDesignError(undefined);
    try {
      const configRef: ConfigService.IConfigRef = await ConfigService.save(config, loaded.configRef);
      setLoaded({ ...loaded, config, configRef, configWarning: undefined });
      setDraft(undefined);
    } catch (e) {
      if (e instanceof ConfigService.ConfigConflictError) {
        setDesignError(TEXT.configConflict);
      } else if (e instanceof ConfigService.ConfigAccessDeniedError) {
        setDesignError(TEXT.configDenied);
      } else {
        setDesignError(errorText(e, TEXT.configSaveFailed));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className={`${classes.root} ${classes.narrow}`}>
        <MessageBar messageBarType={MessageBarType.error}>{loadError}</MessageBar>
        <div className={classes.actions}>
          <DefaultButton text={TEXT.close} onClick={props.onClosed} />
        </div>
      </div>
    );
  }
  if (!loaded || !resolved) {
    return (
      <div className={classes.root}>
        <Spinner size={SpinnerSize.large} label={TEXT.loading} />
      </div>
    );
  }

  const designing: boolean = draft !== undefined;

  const renderer: JSX.Element = (
    <FormContext.Provider value={formContext}>
      <FormRenderer
        form={resolved}
        values={values}
        displayValues={displayValues}
        errors={errors}
        onChange={onFieldChange}
        showHidden={designing}
        selectedField={designing ? selectedField : undefined}
        onFieldSelect={
          designing
            ? (name) => {
                setSelectedField(name);
                setDesignerTab('field');
              }
            : undefined
        }
      />
    </FormContext.Provider>
  );

  return (
    <div className={classes.root} style={designing ? undefined : { maxWidth: resolved.style.maxWidth ?? DEFAULT_FORM_WIDTH }}>
      <div className={classes.header}>
        <h1 className={classes.title} style={{ color: resolved.style.accentColor }}>{resolved.title || props.listTitle}</h1>
        {isAdmin && (
          <Toggle
            inlineLabel
            label={TEXT.designer}
            checked={designing}
            disabled={saving}
            styles={{ root: { marginBottom: 0 } }}
            onChange={(_, checked) => (checked ? startDesign() : cancelDesign())}
          />
        )}
      </div>

      <div className={classes.messages}>
        {isAdmin && loaded.configWarning && (
          <MessageBar messageBarType={MessageBarType.warning}>{loaded.configWarning}</MessageBar>
        )}
        {isAdmin && resolved.missingFields.length > 0 && (
          <MessageBar messageBarType={MessageBarType.warning}>
            {format(TEXT.missingFields, resolved.missingFields.join(', '))}
          </MessageBar>
        )}
        {topErrors.map((message) => (
          <MessageBar key={message} messageBarType={MessageBarType.error}>
            {message}
          </MessageBar>
        ))}
        {designing && <MessageBar>{TEXT.designerNotice}</MessageBar>}
        {designError && <MessageBar messageBarType={MessageBarType.error}>{designError}</MessageBar>}
      </div>

      {designing && draft ? (
        <div className={classes.designLayout}>
          <div className={classes.preview}>
            <Dropdown
              label={TEXT.previewMode}
              options={PREVIEW_OPTIONS}
              selectedKey={previewMode}
              styles={{ root: { maxWidth: 240, marginBottom: 16 } }}
              onChange={(_, option) => option && setPreviewMode(option.key as FormMode)}
            />
            {renderer}
          </div>
          <div className={classes.panel}>
            <div className={classes.panelInner}>
              <div className={classes.panelScroll}>
                <DesignerPanel
                  draft={draft}
                  schema={loaded.schema}
                  tab={designerTab}
                  onTabChange={setDesignerTab}
                  selectedField={selectedField}
                  onSelectField={setSelectedField}
                  onChange={setDraft}
                />
              </div>
              <div className={classes.panelActions}>
                <PrimaryButton
                  text={TEXT.designerSave}
                  disabled={saving}
                  onClick={() => saveDesign().catch(() => undefined)}
                />
                <DefaultButton text={TEXT.cancel} disabled={saving} onClick={cancelDesign} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {renderer}
          <div className={classes.actions}>
            {mode !== 'display' && (
              <PrimaryButton
                text={saving ? TEXT.saving : TEXT.save}
                disabled={saving}
                onClick={() => save(false).catch(() => undefined)}
              />
            )}
            <DefaultButton
              text={mode === 'display' ? TEXT.close : TEXT.cancel}
              disabled={saving}
              // Ha az elem már mentve van (csak a mellékletek hibáztak), a bezárás mentettként jelez vissza.
              onClick={attachmentRetryId !== undefined ? props.onSaved : props.onClosed}
            />
          </div>
        </>
      )}

      <Dialog
        hidden={!conflict}
        onDismiss={() => setConflict(false)}
        dialogContentProps={{ type: DialogType.normal, title: TEXT.conflictTitle, subText: TEXT.conflictText }}
      >
        <DialogFooter>
          <PrimaryButton
            text={TEXT.overwrite}
            onClick={() => {
              setConflict(false);
              save(true).catch(() => undefined);
            }}
          />
          <DefaultButton
            text={TEXT.reload}
            onClick={() => {
              setConflict(false);
              load().catch(() => undefined);
            }}
          />
          <DefaultButton text={TEXT.cancel} onClick={() => setConflict(false)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
};
