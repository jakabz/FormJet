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
import { effectiveActions, isButtonSettableField } from '../engine/ButtonAction';
import { collectGroupIds } from '../engine/ConditionContext';
import { isEmptyValue } from '../engine/ConditionEngine';
import { format } from '../engine/EngineStrings';
import { isLayoutElement, withTextElements } from '../engine/TextElement';
import { ICurrentUser } from '../engine/UserValue';
import {
  createDefaultConfig,
  flattenFields,
  getInitialValues,
  IResolvedField,
  IResolvedForm,
  resolveFieldValue,
  resolveForm
} from '../engine/LayoutResolver';
import { FieldErrors, FormValues, IFieldSchema } from '../models/IFieldSchema';
import { ButtonAction, FormMode, IFormConfig } from '../models/IFormConfig';
import * as AttachmentService from '../services/AttachmentService';
import * as ConfigService from '../services/ConfigService';
import * as GroupService from '../services/GroupService';
import * as ImageService from '../services/ImageService';
import * as ItemService from '../services/ItemService';
import * as PermissionService from '../services/PermissionService';
import * as SchemaService from '../services/SchemaService';
import { withTimeout } from '../services/sp';
import { DesignerPanel, DesignerTab } from './DesignerPanel';
import { EMPTY_ATTACHMENTS, FormContext, IAttachmentsState, IFormContext } from './FormContext';
import { FormRenderer, IFormRendererProps } from './FormRenderer';

// A húzd-és-ejtsd előnézet csak a tervezőben kell; külön csomagrészként töltődik be.
const DesignCanvas = React.lazy(() => import(/* webpackChunkName: 'formjet-designer' */ './DesignCanvas'));

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
/** Egy betöltési lépés legfeljebb ennyi ideig tarthat. */
const LOAD_STEP_TIMEOUT_MS: number = 30000;
const DESIGNER_PANEL_WIDTH: number = 420;
/** Ennél keskenyebb ablakban a tervező panel nem rögzített, hanem a form alá kerül. */
const DESIGNER_NARROW: string = '@media (max-width: 899px)';
const DESIGNER_PANEL_TOP_VAR: string = '--formjet-panel-top';

/** A legközelebbi görgethető szülő felső széle az ablakban (a SharePoint fejlécének alja); 0, ha az ablak görög. */
function getScrollAreaTop(element: HTMLElement): number {
  for (let parent: HTMLElement | null = element.parentElement; parent; parent = parent.parentElement) {
    const overflowY: string = window.getComputedStyle(parent).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent !== document.body && parent !== document.documentElement) {
      return Math.max(0, Math.round(parent.getBoundingClientRect().top));
    }
  }
  return 0;
}

const classes = mergeStyleSets({
  root: { padding: '16px 24px 24px', boxSizing: 'border-box' },
  narrow: { maxWidth: DEFAULT_FORM_WIDTH },
  header: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
  title: { flex: 1, margin: 0, fontSize: 24, fontWeight: 600 },
  messages: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  // Tervező mód: az előnézet az oldallal együtt görög, a tervező panel az ablak jobb széléhez rögzített,
  // teljes magasságú, és a saját tartalmát görgeti. Az előnézet a panel szélességével beljebb húzódik.
  designLayout: {
    paddingRight: DESIGNER_PANEL_WIDTH,
    selectors: { [DESIGNER_NARROW]: { paddingRight: 0 } }
  },
  preview: { minWidth: 0 },
  panel: {
    position: 'fixed',
    // A SharePoint fejléce alatt kezdődik; a változót a FormHost állítja be a görgetett terület helyéből.
    top: `var(${DESIGNER_PANEL_TOP_VAR}, 0px)`,
    right: 0,
    bottom: 0,
    width: DESIGNER_PANEL_WIDTH,
    zIndex: 100,
    boxSizing: 'border-box',
    background: '#ffffff',
    borderLeft: '1px solid #edebe9',
    selectors: {
      // Keskeny képernyőn nem fér el az előnézet mellett: a form alá kerül, saját görgetéssel.
      [DESIGNER_NARROW]: {
        position: 'relative',
        top: 'auto',
        width: 'auto',
        height: '70vh',
        minHeight: DESIGNER_MIN_HEIGHT,
        marginTop: 24,
        zIndex: 'auto',
        borderLeft: 'none',
        borderTop: '1px solid #edebe9'
      }
    }
  },
  panelInner: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 16px 16px 24px',
    selectors: { [DESIGNER_NARROW]: { padding: '16px 0 0' } }
  },
  panelScroll: { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 8 },
  panelActions: { display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #edebe9' },
  actions: { display: 'flex', gap: 8, marginTop: 8 }
});

export interface IFormHostProps {
  mode: FormMode;
  listId: string;
  listTitle: string;
  /** A lista szerverrelatív címe. */
  listUrl: string;
  /** Új elem célmappájának szerverrelatív útvonala. */
  folderPath: string;
  itemId?: number;
  contentTypeId?: string;
  /** A web területi beállításainak kultúrája (dátumformátum). */
  cultureName: string;
  /** A felület nyelve. */
  uiCultureName: string;
  /** A bejelentkezett felhasználó; a személy mezők `[me]` kezdőértékéhez. */
  currentUser: ICurrentUser;
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
  /** A bejelentkezett felhasználó hozta-e létre a megnyitott elemet. */
  isAuthor: boolean;
}

interface IMembershipState extends GroupService.IMembership {
  /** A már lekérdezett csoportok azonosítói. */
  checked: number[];
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback;
}

export const FormHost: React.FC<IFormHostProps> = (props) => {
  const { mode, listId, itemId, currentUser } = props;

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
  // Kiválasztott, de még fel nem töltött képek; mentéskor, az elem mentése előtt töltődnek fel.
  const [pendingImages, setPendingImages] = React.useState<Record<string, File>>({});
  const setPendingImage = React.useCallback((fieldName: string, file: File | undefined): void => {
    setPendingImages((current) => {
      const next: Record<string, File> = { ...current };
      if (file) {
        next[fieldName] = file;
      } else {
        delete next[fieldName];
      }
      return next;
    });
  }, []);

  // Tervező: a draft a konfiguráció mély másolata; a mégse egyszerűen eldobja.
  const [draft, setDraft] = React.useState<IFormConfig | undefined>();
  const [previewMode, setPreviewMode] = React.useState<FormMode>(mode);
  const [designerTab, setDesignerTab] = React.useState<DesignerTab>('layout');
  const [selectedField, setSelectedField] = React.useState<string | undefined>();
  const [designError, setDesignError] = React.useState<string | undefined>();
  // A gombok műveleteit futtató függvény mindig a legfrissebb állapotot látja; a FormContext a stabil burkolót kapja.
  const runActionsRef = React.useRef<(actions: ButtonAction[]) => Promise<void>>(() => Promise.resolve());
  // A gomb műveletével beállított mezők: a mentés ezeket láthatóságtól és szerkeszthetőségtől függetlenül elküldi.
  // Az űrlap élettartamáig megmaradnak, így ütközés utáni felülírásnál vagy javítás utáni újramentésnél is érvényesek.
  const buttonSetFields = React.useRef<Set<string>>(new Set<string>());
  const runActions = React.useCallback((actions: ButtonAction[]): Promise<void> => runActionsRef.current(actions), []);
  // A felhasználó SharePoint csoporttagsága a feltételekben hivatkozott (már lekérdezett) csoportokra.
  const [membership, setMembership] = React.useState<IMembershipState>({ checked: [], memberOf: [], incomplete: false });
  const [siteGroups, setSiteGroups] = React.useState<GroupService.ISiteGroup[] | undefined>();
  // A rögzített tervező panel a görgetett terület tetejénél kezdődik, hogy ne takarja a SharePoint fejlécét.
  const [panelElement, setPanelElement] = React.useState<HTMLDivElement | null>(null);
  const [panelTop, setPanelTop] = React.useState<number>(0);
  React.useEffect(() => {
    if (!panelElement) {
      return undefined;
    }
    const measure = (): void => setPanelTop(getScrollAreaTop(panelElement));
    measure();
    window.addEventListener('resize', measure);
    // A fejléc magassága görgetéskor is változhat (összecsukódó fejléc); a scroll esemény nem buborékol, ezért capture.
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [panelElement]);

  const load = React.useCallback(async (): Promise<void> => {
    // Minden betöltési lépés időkorlátot kap: ha egy kérés nem válaszol, a végtelen betöltés helyett
    // hibaüzenet jelenik meg a lépés nevével (a hibakereséshez).
    const step = <T,>(name: string, promise: Promise<T>): Promise<T> =>
      withTimeout(promise, LOAD_STEP_TIMEOUT_MS, format(strings.LoadStepTimeout, name));
    setLoaded(undefined);
    setLoadError(undefined);
    setErrors({});
    setTopErrors([]);
    try {
      // Edit/Display módban az elem tartalomtípusa az irányadó, ha a kontextus nem adja meg.
      const itemPromise: Promise<ItemService.IItemData | undefined> =
        mode !== 'new' && itemId !== undefined ? step('ItemService.load', ItemService.load(listId, itemId)) : Promise.resolve(undefined);
      let contentTypeId: string | undefined = props.contentTypeId;
      if (!contentTypeId && mode !== 'new') {
        contentTypeId = (await itemPromise)?.contentTypeId;
      }
      const resolvedContentTypeId: string = await step(
        'SchemaService.resolveContentTypeId',
        SchemaService.resolveContentTypeId(listId, contentTypeId)
      );

      const [schema, configResult, item] = await Promise.all([
        step('SchemaService.getFields', SchemaService.getFields(listId, resolvedContentTypeId)),
        step('ConfigService.load', ConfigService.load(listId, resolvedContentTypeId)),
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
        original = { ...original, ...(await step('ItemService.loadUserValues', ItemService.loadUserValues(listId, itemId, userFields))) };
      }
      // A keresőmezőknél ugyanígy: a hivatkozott elemek azonosítóját külön kérdezzük le.
      const lookupFields: ItemService.ILookupFieldRef[] = schema
        .filter((field) => field.LookupListId !== undefined)
        .map((field) => ({ name: field.InternalName, multiple: field.TypeAsString === 'LookupMulti' }));
      if (item && itemId !== undefined && lookupFields.length > 0) {
        original = { ...original, ...(await step('ItemService.loadLookupValues', ItemService.loadLookupValues(listId, itemId, lookupFields))) };
      }
      // Hivatkozás mezők: a cím és a leírás külön lekérdezésből.
      const urlFields: string[] = schema.filter((field) => field.TypeAsString === 'URL').map((field) => field.InternalName);
      if (item && itemId !== undefined && urlFields.length > 0) {
        original = { ...original, ...(await step('ItemService.loadUrlValues', ItemService.loadUrlValues(listId, itemId, urlFields))) };
      }
      // Hely mezők: a helyobjektum JSON-ja külön lekérdezésből.
      const locationFields: string[] = schema
        .filter((field) => field.TypeAsString === 'Location')
        .map((field) => field.InternalName);
      if (item && itemId !== undefined && locationFields.length > 0) {
        original = { ...original, ...(await step('ItemService.loadLocationValues', ItemService.loadLocationValues(listId, itemId, locationFields))) };
      }
      // Felügyelt metaadat mezők: a kifejezések azonosítója külön lekérdezésből.
      const taxonomyFields: ItemService.ITaxonomyFieldRef[] = schema
        .filter((field) => field.TermSetId !== undefined)
        .map((field) => ({ name: field.InternalName, multiple: field.TypeAsString === 'TaxonomyFieldTypeMulti' }));
      if (item && itemId !== undefined && taxonomyFields.length > 0) {
        original = { ...original, ...(await step('ItemService.loadTaxonomyValues', ItemService.loadTaxonomyValues(listId, itemId, taxonomyFields))) };
      }
      // Kép mezők: a képobjektum JSON-ja külön lekérdezésből.
      const imageFields: string[] = schema
        .filter((field) => field.TypeAsString === 'Thumbnail')
        .map((field) => field.InternalName);
      if (item && itemId !== undefined && imageFields.length > 0) {
        original = { ...original, ...(await step('ItemService.loadImageValues', ItemService.loadImageValues(listId, itemId, imageFields))) };
      }

      const hasAttachments: boolean = schema.some((field) => field.TypeAsString === ATTACHMENTS_FIELD);
      const existing: AttachmentService.IAttachmentFile[] =
        item && itemId !== undefined && hasAttachments
          ? await step('AttachmentService.list', AttachmentService.list(listId, itemId)).catch(() => [])
          : [];
      setAttachments({ existing, added: [], removed: [] });
      setAttachmentRetryId(undefined);
      setPendingImages({});

      // A csoporttagságra épülő feltételekhez a tagságot a megjelenítés előtt kérdezzük le, hogy a form ne ugorjon.
      const groupIds: number[] = collectGroupIds(config);
      const groupResult: GroupService.IMembership = await step(
        'GroupService.getMembership',
        GroupService.getMembership(groupIds, !!currentUser.isGuest)
      ).catch(() => ({ memberOf: [], incomplete: true }));
      setMembership({ checked: groupIds, memberOf: groupResult.memberOf, incomplete: groupResult.incomplete });

      setValues(
        item ? original : getInitialValues(schema, config, props.cultureName, undefined, currentUser, groupResult.memberOf)
      );
      setLoaded({
        schema,
        contentTypeId: resolvedContentTypeId,
        config,
        configRef: { itemId: configResult.itemId, etag: configResult.etag },
        configWarning: configResult.warning,
        original,
        displayValues: item ? item.displayValues : {},
        modified: item?.modified,
        // Új elemnél nincs még létrehozó; ott a motor a kitöltőt tekinti annak.
        isAuthor: !!item && item.authorId !== undefined && item.authorId === currentUser.id
      });
    } catch (e) {
      setLoadError(errorText(e, TEXT.loadFailed));
    }
  }, [
    mode,
    listId,
    itemId,
    props.contentTypeId,
    props.cultureName,
    currentUser.loginName,
    currentUser.displayName,
    currentUser.email,
    currentUser.isGuest,
    currentUser.id
  ]);

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
    () =>
      loaded && activeConfig
        ? resolveForm(loaded.schema, activeConfig, activeMode, values, membership.memberOf, loaded.isAuthor, loaded.original)
        : undefined,
    [loaded, activeConfig, activeMode, values, membership]
  );

  // Tervezés közben új csoportra is épülhet feltétel: az előnézethez ennek a tagságát is lekérdezzük.
  const draftGroupKey: string = draft ? collectGroupIds(draft).join(',') : '';
  React.useEffect(() => {
    const missing: number[] = draftGroupKey === '' ? [] : draftGroupKey.split(',').map(Number).filter((id) => membership.checked.indexOf(id) === -1);
    if (missing.length === 0) {
      return;
    }
    GroupService.getMembership(missing, !!currentUser.isGuest)
      .catch(() => ({ memberOf: [], incomplete: true }))
      .then((result) =>
        setMembership((current) => ({
          checked: current.checked.concat(missing.filter((id) => current.checked.indexOf(id) === -1)),
          memberOf: current.memberOf.concat(result.memberOf.filter((id) => current.memberOf.indexOf(id) === -1)),
          incomplete: current.incomplete || result.incomplete
        }))
      )
      .catch(() => undefined);
  }, [draftGroupKey]);

  // A webhely csoportjai a feltételszerkesztőhöz; a tervező első megnyitásakor töltjük be.
  React.useEffect(() => {
    if (draft && !siteGroups) {
      GroupService.getSiteGroups()
        .catch(() => [])
        .then(setSiteGroups)
        .catch(() => undefined);
    }
  }, [draft !== undefined]);

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
      setAttachments,
      listUrl: props.listUrl,
      pendingImages,
      setPendingImage,
      runButtonActions: runActions
    }),
    [props.cultureName, props.uiCultureName, props.listUrl, mode, itemId, loaded, attachments, pendingImages, setPendingImage, runActions]
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

  /**
   * Mentés. A gomb műveletei a frissen beállított értékekkel hívják (`valuesOverride`), mert az állapot
   * frissítése ekkor még nem futott le; ilyenkor a láthatóságot és a szerkeszthetőséget is ezekre számoljuk.
   */
  const save = async (overwrite: boolean, valuesOverride?: FormValues): Promise<void> => {
    const currentValues: FormValues = valuesOverride ?? values;
    const currentResolved: IResolvedForm | undefined =
      valuesOverride && loaded && activeConfig
        ? resolveForm(loaded.schema, activeConfig, mode, currentValues, membership.memberOf, loaded.isAuthor, loaded.original)
        : resolved;
    if (!loaded || !currentResolved || mode === 'display') {
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
    const visibleFields: IResolvedField[] = flattenFields(currentResolved).filter((field) => field.visible);
    // A mező nélküli elemek (felirat, gomb) nem értékek: a gomb nem letiltva sem kerülhet az ellenőrzésbe vagy a mentésbe.
    const editableFields: IResolvedField[] = visibleFields.filter((field) => !field.readOnly && !isLayoutElement(field.schema));

    // 1. Kliens oldali ellenőrzés: a látható, kötelező mezők nem lehetnek üresek.
    const validationErrors: FieldErrors = {};
    editableFields.forEach((field) => {
      const empty: boolean =
        field.schema.TypeAsString === ATTACHMENTS_FIELD
          ? attachments.existing.length - attachments.removed.length + attachments.added.length === 0
          : isEmptyValue(currentValues[field.name]);
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
    //    Kivétel: a gomb műveletével kifejezetten beállított mező (buttonSetFields) akkor is mentődik, ha az űrlapon
    //    rejtett vagy csak olvasható – ezt a tervező szándékosan állította be (2. kulcsdöntés, egyeztetett kivétel).
    const changed: FormValues = {};
    //    A mellékletek nem mezőérték: külön, az elem mentése után kerülnek fel.
    editableFields.forEach((field) => {
      if (field.schema.TypeAsString === ATTACHMENTS_FIELD) {
        return;
      }
      const current: string = currentValues[field.name] ?? '';
      if (current !== (loaded.original[field.name] ?? '')) {
        changed[field.name] = current;
      }
    });
    buttonSetFields.current.forEach((name) => {
      const current: string = currentValues[name] ?? '';
      if (changed[name] === undefined && current !== (loaded.original[name] ?? '')) {
        changed[name] = current;
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

      // A kiválasztott képek feltöltése az elem mentése előtt: a mező értéke a feltöltött fájlra hivatkozik.
      // Hiba esetén a mentés megszakad, az elem nem íródik. A sikeresen feltöltött kép értéke a formon is
      // a végleges lesz, így ismételt mentésnél nem töltődik fel újra.
      const imageUploads: IResolvedField[] = editableFields.filter(
        (field) => field.schema.TypeAsString === 'Thumbnail' && changed[field.name] !== undefined && pendingImages[field.name]
      );
      const uploadedImages: FormValues = {};
      try {
        for (let i: number = 0; i < imageUploads.length; i++) {
          const name: string = imageUploads[i].name;
          const uploaded: string = await ImageService.uploadImage(
            listId,
            mode === 'edit' ? itemId : undefined,
            { name, id: imageUploads[i].schema.FieldId ?? '' },
            pendingImages[name]
          );
          uploadedImages[name] = uploaded;
          setValues((current) => ({ ...current, [name]: uploaded }));
          setPendingImage(name, undefined);
        }
      } catch (e) {
        setTopErrors([errorText(e, strings.ImageUploadFailed)]);
        return;
      }
      const toSave: FormValues = { ...changed, ...uploadedImages };

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
              toSave
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

  /**
   * A gomb műveletei sorban, egymás után: minden lépés megvárja az előzőt. A beállított értékek egy munkapéldányon
   * gyűlnek, és a mentés ezzel fut, így nem a még nem frissült állapotot menti. Mentés vagy bezárás után nem fut
   * több lépés; sikertelen mentésnél a form nyitva marad.
   */
  const runButtonActions = async (actions: ButtonAction[]): Promise<void> => {
    if (!loaded) {
      return;
    }
    let working: FormValues = values;
    for (const action of effectiveActions(actions)) {
      if (action.type === 'setValue') {
        const fieldSchema: IFieldSchema | undefined = loaded.schema.filter((field) => field.InternalName === action.field)[0];
        // Megtekintéskor nincs mit menteni. A nem létező, a SharePointban csak olvasható vagy nem form-string értékű
        // mezőnél (mellékletek, kép) a lépés kimarad.
        if (mode === 'display' || !fieldSchema || !isButtonSettableField(fieldSchema)) {
          continue;
        }
        const value: string = resolveFieldValue(fieldSchema, action.value, props.cultureName, new Date(), currentUser);
        working = { ...working, [action.field]: value };
        // A mező akkor is mentődik, ha az űrlapon rejtett vagy csak olvasható (lásd save, 2. lépés).
        buttonSetFields.current.add(action.field);
        onFieldChange(action.field, value);
      } else if (action.type === 'save') {
        if (mode !== 'display') {
          await save(false, working);
        }
        return;
      } else {
        props.onClosed();
        return;
      }
    }
  };
  runActionsRef.current = runButtonActions;

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

  const rendererProps: IFormRendererProps = {
    form: resolved,
    values,
    displayValues,
    errors,
    onChange: onFieldChange,
    showHidden: designing,
    selectedField: designing ? selectedField : undefined,
    onFieldSelect: designing
      ? (name) => {
          setSelectedField(name);
          setDesignerTab('field');
        }
      : undefined
  };
  /** A tervező elrendezése: balra az előnézet, jobbra a tervező panel. */
  const renderDesignLayout = (
    activeDraft: IFormConfig,
    preview: JSX.Element,
    unplacedPalette: React.ReactNode
  ): JSX.Element => (
    <div className={classes.designLayout}>
      <div className={classes.preview}>
        <Dropdown
          label={TEXT.previewMode}
          options={PREVIEW_OPTIONS}
          selectedKey={previewMode}
          styles={{ root: { maxWidth: 240, marginBottom: 16 } }}
          onChange={(_, option) => option && setPreviewMode(option.key as FormMode)}
        />
        {preview}
      </div>
      <div
        className={classes.panel}
        ref={setPanelElement}
        style={{ [DESIGNER_PANEL_TOP_VAR]: `${panelTop}px` } as React.CSSProperties}
      >
        <div className={classes.panelInner}>
          <div className={classes.panelScroll}>
            <DesignerPanel
              draft={activeDraft}
              // A szövegelemek a tervezőben mezőként választhatók ki és helyezhetők el.
              schema={withTextElements(loaded.schema, activeDraft)}
              siteGroups={siteGroups ?? []}
              tab={designerTab}
              onTabChange={setDesignerTab}
              selectedField={selectedField}
              onSelectField={setSelectedField}
              onChange={setDraft}
              unplacedPalette={unplacedPalette}
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
  );

  const renderer: JSX.Element = (
    <FormContext.Provider value={formContext}>
      <FormRenderer {...rendererProps} />
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
        {isAdmin && membership.incomplete && (
          <MessageBar messageBarType={MessageBarType.warning}>{strings.GroupCheckIncomplete}</MessageBar>
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
        <FormContext.Provider value={formContext}>
          {/* Amíg a húzd-és-ejtsd csomagrész töltődik, a sima előnézet látszik. */}
          <React.Suspense fallback={renderDesignLayout(draft, <FormRenderer {...rendererProps} />, undefined)}>
            <DesignCanvas
              rendererProps={rendererProps}
              draft={draft}
              schema={withTextElements(loaded.schema, draft)}
              onChange={setDraft}
            >
              {(parts) => renderDesignLayout(draft, parts.preview, parts.palette)}
            </DesignCanvas>
          </React.Suspense>
        </FormContext.Provider>
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
