// Admin tervező (Elrendezés / Mező / Stílus / JSON fülek).
// Csak a draft konfigurációt módosítja az onChange-en keresztül, immutábilisan.
// SharePointba nem ír; a mentés a FormHost.saveDesign dolga.

import * as React from 'react';
import { DefaultButton, IconButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Icon } from '@fluentui/react/lib/Icon';
import { Breadcrumb, IBreadcrumbItem } from '@fluentui/react/lib/Breadcrumb';
import { Label } from '@fluentui/react/lib/Label';
import { Link } from '@fluentui/react/lib/Link';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { ATTACHMENTS_FIELD } from '../engine/Attachments';
import { isButtonSettableField, isIconName } from '../engine/ButtonAction';
import { findFieldSection } from '../engine/LayoutMoves';
import { setConditionalValues } from '../engine/ConditionalValue';
import { AUTHOR_VARIABLE, groupVariable, MODE_VARIABLES } from '../engine/ConditionContext';
import { variableRef } from '../engine/FormVariables';
import { format } from '../engine/EngineStrings';
import { parseConfig, unplacedFields } from '../engine/LayoutResolver';
import { addTextElement, isButtonElement, isLayoutElement, isTextElement, removeTextElement } from '../engine/TextElement';
import { isSafeUrl } from '../engine/UrlValue';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  AttachmentsDisplay,
  ConditionalProperty,
  FORM_MODES,
  FormMode,
  IFieldConfig,
  IFieldPlacement,
  IFormConfig,
  ISectionConfig,
  ITextElement,
  LayoutElementKind,
  LOOKUP_CHECKLIST_MAX,
  LookupDisplay,
  SaveMode,
  SectionConditionalProperty
} from '../models/IFormConfig';
import { ISiteGroup } from '../services/GroupService';
import { AccordionCard } from './AccordionCard';
import { BulkConditionDialog } from './BulkConditionDialog';
import { ButtonActionsEditor } from './ButtonActionsEditor';
import { ConditionalValueField } from './ConditionalValueEditor';
import { ConditionEditor } from './ConditionEditor';
import { RelatedListEditor } from './RelatedListEditor';
import { StylePanel, StyleTarget } from './StylePanel';
import { VariablesPanel } from './VariablesPanel';

/** A panel fülei; a Változók és a JSON csak az űrlap kijelölésénél látszik. */
export type DesignerTab = 'properties' | 'style' | 'variables' | 'json';

/** A tervezőben kijelölt elem: az űrlap, egy szakasz vagy egy mező (felirat, gomb is). */
export type DesignerSelection = StyleTarget;

const MODE_LABELS: Record<FormMode, string> = {
  new: strings.ModeNew,
  edit: strings.ModeEdit,
  display: strings.ModeDisplay
};

// Függvény, nem modulszintű állandó: a format() hiányzó szövegre hibát dobna, és a modul betöltésekor
// ez az egész form megjelenését megakadályozná.
function lookupDisplayOptions(): IDropdownOption[] {
  return [
    { key: 'auto', text: format(strings.LookupDisplayAuto, LOOKUP_CHECKLIST_MAX) },
    { key: 'checklist', text: strings.LookupDisplayChecklist },
    { key: 'dropdown', text: strings.LookupDisplayDropdown }
  ];
}

const COLUMN_OPTIONS: IDropdownOption[] = [1, 2, 3, 4].map((n) => ({ key: n, text: String(n) }));

const classes = mergeStyleSets({
  tab: { paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 4 },
  rowName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' },
  modes: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  hint: { fontSize: 12, color: '#605e5c' },
  // A felirat és a gomb hozzáadása a szekciókártya alján, teljes szélességben.
  addElement: { width: '100%' },
  toolbar: { display: 'flex', justifyContent: 'flex-end', gap: 4 },
  tree: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', border: '1px solid #edebe9', borderRadius: 2 },
  treeSection: { fontWeight: 600 },
  treeFields: { display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0 0 16px' },
  treeField: { textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  iconRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  iconName: { flex: 1, minWidth: 0 },
  iconPreview: { fontSize: 20, width: 24, marginTop: 34, color: '#323130' },
  spanDropdown: { width: 64 }
});

export interface IDesignerPanelProps {
  draft: IFormConfig;
  schema: IFieldSchema[];
  tab: DesignerTab;
  onTabChange: (tab: DesignerTab) => void;
  /** A kijelölt elem; a panel csak ennek a tulajdonságait mutatja. */
  selection: DesignerSelection;
  onSelect: (selection: DesignerSelection) => void;
  onChange: (draft: IFormConfig) => void;
  /** A webhely SharePoint csoportjai; a feltételekben a tagságuk vizsgálható. */
  siteGroups: ISiteGroup[];
  /** A még el nem helyezett mezők behúzható listája (a húzd-és-ejtsd felülettől); hiányában szöveges felsorolás látszik. */
  unplacedPalette?: React.ReactNode;
}

/** Az ikonnév hibaüzenete; a hibás nevet a parseConfig elhagyja, ezért itt jelezzük. */
function buttonIconError(icon: string | undefined): string | undefined {
  return icon && !isIconName(icon) ? strings.ButtonElementIconInvalid : undefined;
}

function iconPreview(icon: string | undefined): string | undefined {
  return icon && isIconName(icon) ? icon : undefined;
}

/** A gomb címének hibaüzenete, ha a cím nem biztonságos (a gomb ilyenkor nem nyit meg semmit). */
function buttonUrlError(url: string | undefined): string | undefined {
  return url && !isSafeUrl(url) ? strings.ButtonElementUrlInvalid : undefined;
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) {
    return items;
  }
  const next: T[] = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  const next: T[] = items.slice();
  next[index] = item;
  return next;
}

/** Az undefined értékű kulcsok elhagyása, hogy a mentett JSON tiszta maradjon. */
function compact<T extends object>(input: T): T {
  const result: Record<string, unknown> = {};
  const source = input as Record<string, unknown>;
  Object.keys(source).forEach((key) => {
    if (source[key] !== undefined && source[key] !== '') {
      result[key] = source[key];
    }
  });
  return result as T;
}

interface IModeCheckboxesProps {
  label: string;
  value: FormMode[] | undefined;
  /** Mit jelent a hiányzó érték: minden mód (láthatóság) vagy egyik sem (csak olvasható, kötelező). */
  missingMeansAll: boolean;
  onChange: (value: FormMode[] | undefined) => void;
}

const ModeCheckboxes: React.FC<IModeCheckboxesProps> = (props) => {
  const current: FormMode[] = props.value ?? (props.missingMeansAll ? FORM_MODES : []);
  const toggle = (mode: FormMode, checked: boolean): void => {
    const next: FormMode[] = FORM_MODES.filter((m) => (m === mode ? checked : current.indexOf(m) !== -1));
    const isDefault: boolean = props.missingMeansAll ? next.length === FORM_MODES.length : next.length === 0;
    props.onChange(isDefault ? undefined : next);
  };
  return (
    <div>
      <Label>{props.label}</Label>
      <div className={classes.modes}>
        {FORM_MODES.map((mode) => (
          <Checkbox
            key={mode}
            label={MODE_LABELS[mode]}
            checked={current.indexOf(mode) !== -1}
            onChange={(_, checked) => toggle(mode, !!checked)}
          />
        ))}
      </div>
    </div>
  );
};

export const DesignerPanel: React.FC<IDesignerPanelProps> = (props) => {
  const { draft, schema } = props;
  // A nem létező elemre mutató kijelölés (például törlés vagy JSON-csere után) az űrlapra esik vissza.
  const selection: DesignerSelection = props.selection;
  const current: DesignerSelection =
    (selection.kind === 'section' && !draft.sections.some((section) => section.id === selection.id)) ||
    (selection.kind === 'field' && !schema.some((field) => field.InternalName === selection.name))
      ? { kind: 'form' }
      : selection;
  const selectedField: string | undefined = current.kind === 'field' ? current.name : undefined;
  // A Változók és a JSON fül csak az űrlapnál van; máshol a Tulajdonságok látszik.
  const tab: DesignerTab = current.kind !== 'form' && (props.tab === 'variables' || props.tab === 'json') ? 'properties' : props.tab;
  const select = (next: DesignerSelection): void => props.onSelect(next);
  const [jsonText, setJsonText] = React.useState<string>('');
  const [jsonError, setJsonError] = React.useState<string | undefined>();
  // A nem elhelyezett mezők sávja összecsukható; alapból nyitva.
  const [paletteOpen, setPaletteOpen] = React.useState<boolean>(true);
  // Szövegelem felvétele: a felugró ablak melyik szekcióhoz nyílt meg, és a beírt megnevezés.
  const [elementDialog, setElementDialog] = React.useState<{ sectionId: string; kind: LayoutElementKind } | undefined>();
  const [newTextName, setNewTextName] = React.useState<string>('');
  const [bulkOpen, setBulkOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    setJsonText(JSON.stringify(draft, undefined, 2));
    setJsonError(undefined);
  }, [draft]);

  const titleOf = (name: string): string => {
    const field: IFieldSchema | undefined = schema.find((f) => f.InternalName === name);
    return field ? `${field.Title} (${name})` : format(strings.NonexistentField, name);
  };

  const updateSection = (index: number, patch: Partial<ISectionConfig>): void => {
    const section: ISectionConfig = compact({ ...draft.sections[index], ...patch });
    props.onChange({ ...draft, sections: replaceAt(draft.sections, index, section) });
  };

  const updatePlacements = (index: number, fields: IFieldPlacement[]): void => {
    updateSection(index, { fields });
  };

  const addSection = (): void => {
    let n: number = draft.sections.length + 1;
    while (draft.sections.some((s) => s.id === `section-${n}`)) {
      n++;
    }
    props.onChange({
      ...draft,
      sections: [...draft.sections, { id: `section-${n}`, title: strings.NewSection, columns: 1, fields: [] }]
    });
    select({ kind: 'section', id: `section-${n}` });
  };

  const updateField = (name: string, patch: Partial<IFieldConfig>): void => {
    const field: IFieldConfig = compact({ ...(draft.fields[name] ?? {}), ...patch });
    props.onChange({ ...draft, fields: { ...draft.fields, [name]: field } });
  };

  const updateText = (id: string, patch: Partial<ITextElement>): void => {
    const current: ITextElement = draft.texts?.[id] ?? { name: '' };
    const text: ITextElement = { ...current, ...patch };
    // Az üresre állított tulajdonság kimarad a konfigurációból.
    (Object.keys(text) as Array<keyof ITextElement>).forEach((key) => {
      if (text[key] === undefined) {
        delete text[key];
      }
    });
    props.onChange({ ...draft, texts: { ...(draft.texts ?? {}), [id]: text } });
  };

  /** Új szövegelem a felugró ablakban megadott megnevezéssel, annak a szekciónak a végére, amelyben a gombra kattintottak. */
  const addText = (): void => {
    if (newTextName.trim() === '') {
      return;
    }
    const added = addTextElement(draft, newTextName.trim(), elementDialog?.sectionId, elementDialog?.kind);
    props.onChange(added.config);
    setElementDialog(undefined);
    setNewTextName('');
    // A tartalom az új elem tulajdonságai között adható meg.
    select({ kind: 'field', name: added.id });
    props.onTabChange('properties');
  };

  // A feltételek és a kapcsolódó elemek csak valódi mezőre hivatkozhatnak; a szövegelemnek nincs értéke.
  const realFields: IFieldSchema[] = schema.filter((f) => !isLayoutElement(f));
  // A gomb „mező értékének beállítása” lépéséhez: a SharePoint szerint írható mezők (az űrlapon rejtettek is).
  const actionFields: IFieldSchema[] = realFields.filter(isButtonSettableField);

  // A feltételekben a mezők mellett a környezeti változók is választhatók (a form módja, csoporttagság);
  // igen / nem értékűek, ezért a feltételszerkesztő Boolean mezőként kezeli őket.
  const conditionFields: IFieldSchema[] = React.useMemo(() => {
    const variable = (name: string, title: string): IFieldSchema => ({
      InternalName: name,
      Title: title,
      TypeAsString: 'Boolean',
      Required: false,
      ReadOnlyField: true
    });
    return realFields.concat(
      [
        variable(MODE_VARIABLES.new, strings.ConditionVarIsNew),
        variable(MODE_VARIABLES.edit, strings.ConditionVarIsEdit),
        variable(MODE_VARIABLES.display, strings.ConditionVarIsDisplay),
        variable(AUTHOR_VARIABLE, strings.ConditionVarIsAuthor)
      ],
      props.siteGroups.map((group) => variable(groupVariable(group.id), format(strings.ConditionVarGroup, group.title))),
      // A form változói: feltétel fajtánál igen / nem, érték fajtánál (számmá alakítva) szám vagy szöveg.
      Object.keys(draft.variables ?? {}).map((name) => {
        const definition = (draft.variables ?? {})[name];
        const transforms = definition.transforms ?? [];
        const type: string =
          definition.kind === 'condition' ? 'Boolean' : transforms.length > 0 && transforms[transforms.length - 1].type === 'number' ? 'Number' : 'Text';
        return { ...variable(variableRef(name), format(strings.ConditionVarVariable, name)), TypeAsString: type };
      })
    );
  }, [schema, props.siteGroups, draft.variables]);

  const unplaced: IFieldSchema[] = unplacedFields(schema, draft);
  const unplacedOptions: IDropdownOption[] = unplaced.map((f) => ({
    key: f.InternalName,
    text: `${f.Title} (${f.InternalName})`
  }));

  /** A szekció egy szöveges beállítása a feltételes értékek gombjával. */
  const sectionConditionalField = (
    index: number,
    property: SectionConditionalProperty,
    label: string,
    input: JSX.Element
  ): JSX.Element => {
    const section: ISectionConfig = draft.sections[index];
    return (
      <ConditionalValueField
        key={`${section.id}:${property}`}
        label={label}
        fieldTitle={section.title || section.id}
        rules={section.conditional?.[property] ?? []}
        schema={conditionFields}
        onChange={(rules) =>
          props.onChange({
            ...draft,
            sections: replaceAt(draft.sections, index, setConditionalValues(section, property, rules))
          })
        }
      >
        {input}
      </ConditionalValueField>
    );
  };

  /** Az űrlap tulajdonságai: cím, felépítés (fa nézet, kattintással kijelölhető), tömeges feltétel, új szakasz. */
  const renderFormProps = (): JSX.Element => (
    <div className={classes.tab}>
      <TextField label={strings.FormTitle} value={draft.title ?? ''} onChange={(_, v) => props.onChange(compact({ ...draft, title: v }))} />
      <Dropdown
        label={strings.SaveMode}
        options={[
          { key: 'default', text: strings.SaveModeDefault },
          { key: 'extended', text: strings.SaveModeExtended }
        ]}
        selectedKey={draft.saveMode ?? 'default'}
        onChange={(_, option) =>
          option && props.onChange(compact({ ...draft, saveMode: option.key === 'default' ? undefined : (option.key as SaveMode) }))
        }
      />
      <div className={classes.hint}>{strings.SaveModeHint}</div>
      <DefaultButton
        className={classes.addElement}
        iconProps={{ iconName: 'MultiSelect' }}
        text={strings.BulkConditionOpen}
        onClick={() => setBulkOpen(true)}
      />
      <div>
        <Label>{strings.DesignTree}</Label>
        <div className={classes.tree}>
          {draft.sections.length === 0 && <div className={classes.hint}>{strings.DesignTreeEmpty}</div>}
          {draft.sections.map((section) => (
            <div key={section.id}>
              <Link className={classes.treeSection} onClick={() => select({ kind: 'section', id: section.id })}>
                {section.title || section.id}
              </Link>
              <div className={classes.treeFields}>
                {section.fields.map((placement) => (
                  <Link key={placement.field} className={classes.treeField} onClick={() => select({ kind: 'field', name: placement.field })}>
                    {titleOf(placement.field)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DefaultButton className={classes.addElement} iconProps={{ iconName: 'Add' }} text={strings.NewSection} onClick={addSection} />
    </div>
  );

  const renderSectionProps = (section: ISectionConfig, index: number): JSX.Element => (
    <div className={classes.tab}>
      <div className={classes.toolbar}>
        <IconButton
          iconProps={{ iconName: 'Up' }}
          title={strings.SectionMoveUp}
          disabled={index === 0}
          onClick={() => props.onChange({ ...draft, sections: move(draft.sections, index, index - 1) })}
        />
        <IconButton
          iconProps={{ iconName: 'Down' }}
          title={strings.SectionMoveDown}
          disabled={index === draft.sections.length - 1}
          onClick={() => props.onChange({ ...draft, sections: move(draft.sections, index, index + 1) })}
        />
        <IconButton
          iconProps={{ iconName: 'Delete' }}
          title={strings.SectionDelete}
          onClick={() => {
            props.onChange({ ...draft, sections: draft.sections.filter((_, i) => i !== index) });
            select({ kind: 'form' });
          }}
        />
      </div>
      {/* A cím és a leírás feltételhez is köthető, ugyanúgy, mint a mező címkéje. */}
      {sectionConditionalField(
        index,
        'title',
        strings.SectionTitle,
        <TextField label={strings.SectionTitle} value={section.title ?? ''} onChange={(_, v) => updateSection(index, { title: v })} />
      )}
      {sectionConditionalField(
        index,
        'description',
        strings.Description,
        <TextField
          label={strings.Description}
          value={section.description ?? ''}
          onChange={(_, v) => updateSection(index, { description: v })}
        />
      )}
      <Dropdown
        label={strings.ColumnCount}
        options={COLUMN_OPTIONS}
        selectedKey={section.columns}
        onChange={(_, option) => option && updateSection(index, { columns: Number(option.key) })}
      />
      <div className={classes.modes}>
        <Checkbox
          label={strings.Collapsible}
          checked={!!section.collapsible}
          onChange={(_, checked) =>
            updateSection(index, { collapsible: checked || undefined, collapsed: checked ? section.collapsed : undefined })
          }
        />
        <Checkbox
          label={strings.CollapsedByDefault}
          disabled={!section.collapsible}
          checked={!!section.collapsed}
          onChange={(_, checked) => updateSection(index, { collapsed: checked || undefined })}
        />
      </div>
      <ModeCheckboxes
        label={strings.VisibleInModes}
        value={section.visibleIn}
        missingMeansAll
        onChange={(visibleIn) => updateSection(index, { visibleIn })}
      />
      <ConditionEditor
        schema={conditionFields}
        label={strings.VisibleWhen}
        value={section.visibleWhen}
        onChange={(visibleWhen) => updateSection(index, { visibleWhen })}
      />
      {/* Teljesülésekor a szakasz összes mezője csak olvasható, a gombjai letiltottak. */}
      <ConditionEditor
        key={`${section.id}:ReadOnlyWhen`}
        schema={conditionFields}
        label={strings.DisabledWhen}
        value={section.readOnlyWhen}
        onChange={(readOnlyWhen) => updateSection(index, { readOnlyWhen })}
      />
      <div className={classes.hint}>{strings.SectionDisabledHint}</div>
      <RelatedListEditor
        value={section.related}
        schema={realFields}
        onChange={(related) => updateSection(index, { related })}
      />

      <Label>{strings.Fields}</Label>
      {section.fields.length === 0 && <div className={classes.hint}>{strings.SectionEmpty}</div>}
      {section.fields.map((placement, i) => (
        <div key={placement.field} className={classes.row}>
          <span
            className={classes.rowName}
            title={strings.FieldSettings}
            onClick={() => select({ kind: 'field', name: placement.field })}
          >
            {titleOf(placement.field)}
          </span>
          <Dropdown
            className={classes.spanDropdown}
            title={strings.FieldWidth}
            ariaLabel={strings.FieldWidth}
            options={COLUMN_OPTIONS.slice(0, section.columns)}
            selectedKey={Math.min(placement.colSpan ?? 1, section.columns)}
            onChange={(_, option) =>
              option &&
              updatePlacements(
                index,
                replaceAt(section.fields, i, compact({ ...placement, colSpan: option.key === 1 ? undefined : Number(option.key) }))
              )
            }
          />
          <IconButton
            iconProps={{ iconName: 'Up' }}
            title={strings.FieldMoveUp}
            disabled={i === 0}
            onClick={() => updatePlacements(index, move(section.fields, i, i - 1))}
          />
          <IconButton
            iconProps={{ iconName: 'Down' }}
            title={strings.FieldMoveDown}
            disabled={i === section.fields.length - 1}
            onClick={() => updatePlacements(index, move(section.fields, i, i + 1))}
          />
          <IconButton
            iconProps={{ iconName: 'Cancel' }}
            title={strings.FieldRemove}
            onClick={() => updatePlacements(index, section.fields.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {unplacedOptions.length > 0 && (
        <Dropdown
          placeholder={strings.AddField}
          ariaLabel={strings.AddField}
          options={unplacedOptions}
          selectedKey={null}
          onChange={(_, option) => option && updatePlacements(index, [...section.fields, { field: String(option.key) }])}
        />
      )}
      <DefaultButton
        className={classes.addElement}
        iconProps={{ iconName: 'InsertTextBox' }}
        text={strings.TextElementAdd}
        onClick={() => {
          setNewTextName('');
          setElementDialog({ sectionId: section.id, kind: 'text' });
        }}
      />
      <DefaultButton
        className={classes.addElement}
        iconProps={{ iconName: 'ButtonControl' }}
        text={strings.ButtonElementAdd}
        onClick={() => {
          setNewTextName('');
          setElementDialog({ sectionId: section.id, kind: 'button' });
        }}
      />
    </div>
  );

  const renderFieldTab = (): JSX.Element => {
    const fieldSchema: IFieldSchema | undefined = schema.find((f) => f.InternalName === selectedField);
    const config: IFieldConfig = (selectedField && draft.fields[selectedField]) || {};
    /** Egy szöveges beállítás a feltételes értékek gombjával. */
    const conditionalField = (
      property: ConditionalProperty,
      label: string,
      input: JSX.Element,
      hint?: string
    ): JSX.Element | undefined =>
      selectedField === undefined ? undefined : (
        <ConditionalValueField
          key={`${selectedField}:${property}`}
          label={label}
          fieldTitle={fieldSchema?.Title ?? selectedField}
          rules={config.conditional?.[property] ?? []}
          schema={conditionFields}
          hint={hint}
          onChange={(rules) =>
            props.onChange({
              ...draft,
              fields: { ...draft.fields, [selectedField]: setConditionalValues(config, property, rules) }
            })
          }
        >
          {input}
        </ConditionalValueField>
      );
    return (
      <div className={classes.tab}>
        {selectedField && fieldSchema && isTextElement(fieldSchema) && (
          <>
            <div className={classes.hint}>{strings.TextElementHint}</div>
            <TextField
              label={strings.TextElementName}
              value={draft.texts?.[selectedField]?.name ?? ''}
              onChange={(_, v) => updateText(selectedField, { name: v ?? '' })}
            />
            <TextField
              label={strings.TextElementContent}
              multiline
              autoAdjustHeight
              rows={4}
              value={draft.texts?.[selectedField]?.content ?? ''}
              onChange={(_, v) => updateText(selectedField, { content: v || undefined })}
            />
            <ModeCheckboxes
              label={strings.VisibleInModes}
              value={config.visibleIn}
              missingMeansAll
              onChange={(visibleIn) => updateField(selectedField, { visibleIn })}
            />
            <ConditionEditor
              key={`${selectedField}:VisibleWhen`}
              schema={conditionFields}
              label={strings.VisibleWhen}
              value={config.visibleWhen}
              onChange={(visibleWhen) => updateField(selectedField, { visibleWhen })}
            />
            <DefaultButton
              iconProps={{ iconName: 'Delete' }}
              text={strings.TextElementDelete}
              onClick={() => {
                props.onChange(removeTextElement(draft, selectedField));
                // A törölt elem helyett a szülő szakasza (ennek hiányában az űrlap) lesz kijelölve.
                const parentId: string | undefined = findFieldSection(draft, selectedField);
                select(parentId ? { kind: 'section', id: parentId } : { kind: 'form' });
              }}
            />
          </>
        )}
        {selectedField && fieldSchema && isButtonElement(fieldSchema) && (
          <>
            <div className={classes.hint}>{strings.ButtonElementHint}</div>
            <TextField
              label={strings.ButtonElementName}
              value={draft.texts?.[selectedField]?.name ?? ''}
              onChange={(_, v) => updateText(selectedField, { name: v ?? '' })}
            />
            <div className={classes.iconRow}>
              <TextField
                className={classes.iconName}
                label={strings.ButtonElementIcon}
                description={strings.ButtonElementIconHint}
                value={draft.texts?.[selectedField]?.icon ?? ''}
                errorMessage={buttonIconError(draft.texts?.[selectedField]?.icon)}
                onChange={(_, v) => updateText(selectedField, { icon: v?.trim() || undefined })}
              />
              {/* Előnézet: a megadott ikon (ismeretlen névnél üres). */}
              <Icon className={classes.iconPreview} iconName={iconPreview(draft.texts?.[selectedField]?.icon)} />
            </div>
            <ButtonActionsEditor
              buttonTitle={draft.texts?.[selectedField]?.name || selectedField}
              actions={draft.texts?.[selectedField]?.actions ?? []}
              fields={actionFields}
              onChange={(actions) => updateText(selectedField, { actions: actions.length > 0 ? actions : undefined })}
            />
            <TextField
              label={strings.ButtonElementUrl}
              description={
                (draft.texts?.[selectedField]?.actions ?? []).length > 0
                  ? strings.ButtonElementUrlIgnored
                  : strings.ButtonElementUrlHint
              }
              value={draft.texts?.[selectedField]?.url ?? ''}
              errorMessage={buttonUrlError(draft.texts?.[selectedField]?.url)}
              onChange={(_, v) => updateText(selectedField, { url: v?.trim() || undefined })}
            />
            <Checkbox
              label={strings.ButtonElementNewTab}
              checked={!!draft.texts?.[selectedField]?.newTab}
              onChange={(_, checked) => updateText(selectedField, { newTab: checked || undefined })}
            />
            <ModeCheckboxes
              label={strings.VisibleInModes}
              value={config.visibleIn}
              missingMeansAll
              onChange={(visibleIn) => updateField(selectedField, { visibleIn })}
            />
            {/* A gombnál a „csak olvasható” beállítás a letiltást jelenti. */}
            <ModeCheckboxes
              label={strings.DisabledInModes}
              value={config.readOnlyIn}
              missingMeansAll={false}
              onChange={(readOnlyIn) => updateField(selectedField, { readOnlyIn })}
            />
            <ConditionEditor
              key={`${selectedField}:VisibleWhen`}
              schema={conditionFields}
              label={strings.VisibleWhen}
              value={config.visibleWhen}
              onChange={(visibleWhen) => updateField(selectedField, { visibleWhen })}
            />
            <ConditionEditor
              key={`${selectedField}:ReadOnlyWhen`}
              schema={conditionFields}
              label={strings.DisabledWhen}
              value={config.readOnlyWhen}
              onChange={(readOnlyWhen) => updateField(selectedField, { readOnlyWhen })}
            />
            <DefaultButton
              iconProps={{ iconName: 'Delete' }}
              text={strings.ButtonElementDelete}
              onClick={() => {
                props.onChange(removeTextElement(draft, selectedField));
                // A törölt elem helyett a szülő szakasza (ennek hiányában az űrlap) lesz kijelölve.
                const parentId: string | undefined = findFieldSection(draft, selectedField);
                select(parentId ? { kind: 'section', id: parentId } : { kind: 'form' });
              }}
            />
          </>
        )}
        {selectedField && fieldSchema && !isLayoutElement(fieldSchema) && (
          <>
            <div className={classes.hint}>
              {format(strings.FieldType, fieldSchema.TypeAsString)}
              {fieldSchema.Required ? ' · ' + strings.SpRequired : ''}
              {fieldSchema.ReadOnlyField ? ' · ' + strings.SpReadOnly : ''}
            </div>
            {/* A négy szöveges beállítás feltételhez is köthető: a mező melletti gomb a szabályokat nyitja meg. */}
            {conditionalField(
              'label',
              strings.FieldLabel,
              <TextField
                label={strings.FieldLabel}
                placeholder={fieldSchema.Title}
                value={config.label ?? ''}
                onChange={(_, v) => updateField(selectedField, { label: v })}
              />
            )}
            {conditionalField(
              'description',
              strings.Description,
              <TextField
                label={strings.Description}
                placeholder={fieldSchema.Description}
                value={config.description ?? ''}
                onChange={(_, v) => updateField(selectedField, { description: v })}
              />
            )}
            {conditionalField(
              'placeholder',
              strings.PlaceholderText,
              <TextField
                label={strings.PlaceholderText}
                value={config.placeholder ?? ''}
                onChange={(_, v) => updateField(selectedField, { placeholder: v })}
              />
            )}
            <div>
              {conditionalField(
                'defaultValue',
                strings.DefaultValue,
                <TextField
                  label={strings.DefaultValue}
                  value={config.defaultValue ?? ''}
                  onChange={(_, v) => updateField(selectedField, { defaultValue: v })}
                />,
                `${strings.ConditionalValueDefaultHint} ${strings.DefaultValueHint}`
              )}
              <div className={classes.hint}>{strings.DefaultValueHint}</div>
            </div>
            {fieldSchema.TypeAsString === ATTACHMENTS_FIELD && (
              <Dropdown
                label={strings.AttachmentsDisplay}
                options={[
                  { key: 'list', text: strings.AttachmentsDisplayList },
                  { key: 'compact', text: strings.AttachmentsDisplayCompact }
                ]}
                selectedKey={config.attachmentsDisplay ?? 'list'}
                onChange={(_, option) =>
                  option &&
                  updateField(selectedField, {
                    attachmentsDisplay: option.key === 'list' ? undefined : (option.key as AttachmentsDisplay)
                  })
                }
              />
            )}
            {fieldSchema.TypeAsString === 'LookupMulti' && (
              <Dropdown
                label={strings.LookupDisplay}
                options={lookupDisplayOptions()}
                selectedKey={config.lookupDisplay ?? 'auto'}
                onChange={(_, option) =>
                  option &&
                  updateField(selectedField, {
                    lookupDisplay: option.key === 'auto' ? undefined : (option.key as LookupDisplay)
                  })
                }
              />
            )}
            <ModeCheckboxes
              label={strings.VisibleInModes}
              value={config.visibleIn}
              missingMeansAll
              onChange={(visibleIn) => updateField(selectedField, { visibleIn })}
            />
            <ModeCheckboxes
              label={strings.ReadOnlyInModes}
              value={config.readOnlyIn}
              missingMeansAll={false}
              onChange={(readOnlyIn) => updateField(selectedField, { readOnlyIn })}
            />
            <ModeCheckboxes
              label={strings.RequiredInModes}
              value={config.requiredIn}
              missingMeansAll={false}
              onChange={(requiredIn) => updateField(selectedField, { requiredIn })}
            />
            <div className={classes.hint}>
              {strings.RequiredOnlyStricter}
            </div>
            <ConditionEditor
              key={`${selectedField}:VisibleWhen`}
              schema={conditionFields}
              label={strings.VisibleWhen}
              value={config.visibleWhen}
              onChange={(visibleWhen) => updateField(selectedField, { visibleWhen })}
            />
            <ConditionEditor
              key={`${selectedField}:ReadOnlyWhen`}
              schema={conditionFields}
              label={strings.ReadOnlyWhen}
              value={config.readOnlyWhen}
              onChange={(readOnlyWhen) => updateField(selectedField, { readOnlyWhen })}
            />
            <ConditionEditor
              key={`${selectedField}:RequiredWhen`}
              schema={conditionFields}
              label={strings.RequiredWhen}
              value={config.requiredWhen}
              onChange={(requiredWhen) => updateField(selectedField, { requiredWhen })}
            />
          </>
        )}
      </div>
    );
  };

  const applyJson = (): void => {
    const parsed = parseConfig(jsonText);
    if (!parsed.config) {
      setJsonError(parsed.error);
      return;
    }
    // A lista és a tartalomtípus nem írható át a JSON fülön.
    props.onChange({ ...parsed.config, listId: draft.listId, contentTypeId: draft.contentTypeId });
  };

  const dialogTitle: string = elementDialog?.kind === 'button' ? strings.ButtonElementAdd : strings.TextElementAdd;

  // Morzsamenü: Űrlap › szakasz › mező; egy szinttel feljebb lépni is innen lehet.
  const fieldSection: ISectionConfig | undefined =
    current.kind === 'field' ? draft.sections.filter((section) => section.id === findFieldSection(draft, current.name))[0] : undefined;
  const crumbSection: ISectionConfig | undefined =
    current.kind === 'section' ? draft.sections.filter((section) => section.id === current.id)[0] : fieldSection;
  const crumbs: IBreadcrumbItem[] = [{ key: 'form', text: strings.DesignForm, onClick: () => select({ kind: 'form' }) }];
  if (crumbSection) {
    const sectionId: string = crumbSection.id;
    crumbs.push({ key: `section:${sectionId}`, text: crumbSection.title || sectionId, onClick: () => select({ kind: 'section', id: sectionId }) });
  }
  if (current.kind === 'field') {
    crumbs.push({ key: `field:${current.name}`, text: schema.filter((f) => f.InternalName === current.name)[0]?.Title ?? current.name });
  }

  const sectionIndex: number = current.kind === 'section' ? draft.sections.findIndex((section) => section.id === current.id) : -1;

  const pivotItems: JSX.Element[] = [
    <PivotItem key="properties" headerText={strings.TabProperties} itemKey="properties">
      {current.kind === 'form' && renderFormProps()}
      {current.kind === 'section' && sectionIndex !== -1 && renderSectionProps(draft.sections[sectionIndex], sectionIndex)}
      {current.kind === 'field' && renderFieldTab()}
    </PivotItem>,
    <PivotItem key="style" headerText={strings.TabStyle} itemKey="style">
      <StylePanel draft={draft} schema={schema} target={current} onChange={props.onChange} />
    </PivotItem>
  ];
  if (current.kind === 'form') {
    pivotItems.push(
      <PivotItem key="variables" headerText={strings.TabVariables} itemKey="variables">
        <VariablesPanel draft={draft} fields={realFields} conditionFields={conditionFields} onChange={props.onChange} />
      </PivotItem>,
      <PivotItem key="json" headerText={strings.TabJson} itemKey="json">
        <div className={classes.tab}>
          {jsonError && <MessageBar messageBarType={MessageBarType.error}>{jsonError}</MessageBar>}
          <TextField
            ariaLabel={strings.ConfigJson}
            multiline
            rows={24}
            value={jsonText}
            styles={{ field: { fontFamily: 'Consolas, Menlo, monospace', fontSize: 12 } }}
            onChange={(_, v) => setJsonText(v ?? '')}
          />
          <PrimaryButton text={strings.Apply} onClick={applyJson} />
        </div>
      </PivotItem>
    );
  }

  return (
    <>
      <Breadcrumb items={crumbs} maxDisplayedItems={3} styles={{ root: { margin: '0 0 8px' } }} />
      {/* A nem elhelyezett mezők mindig elérhetők, hogy bármelyik kijelölés mellett az előnézetbe húzhatók legyenek. */}
      <AccordionCard
        title={format(strings.UnplacedFieldsCount, unplaced.length)}
        open={paletteOpen}
        onToggle={() => setPaletteOpen(!paletteOpen)}
      >
        {unplaced.length > 0 && props.unplacedPalette ? (
          props.unplacedPalette
        ) : (
          <div className={classes.hint}>
            {unplaced.length === 0 ? strings.AllFieldsPlaced : format(strings.UnplacedFieldsList, unplaced.map((f) => f.Title).join(', '))}
          </div>
        )}
      </AccordionCard>
      <Pivot selectedKey={tab} onLinkClick={(item) => item?.props.itemKey && props.onTabChange(item.props.itemKey as DesignerTab)}>
        {pivotItems}
      </Pivot>
      <BulkConditionDialog
        hidden={!bulkOpen}
        draft={draft}
        schema={schema}
        conditionFields={conditionFields}
        onChange={props.onChange}
        onDismiss={() => setBulkOpen(false)}
      />
      {/* Új szövegelem: a megnevezést felugró ablakban kérjük be. */}
      <Dialog
        hidden={elementDialog === undefined}
        minWidth={400}
        dialogContentProps={{ type: DialogType.normal, title: dialogTitle }}
        modalProps={{ isBlocking: false }}
        onDismiss={() => setElementDialog(undefined)}
      >
        <TextField
          label={elementDialog?.kind === 'button' ? strings.ButtonElementNewName : strings.TextElementNewName}
          value={newTextName}
          autoFocus
          onChange={(_, v) => setNewTextName(v ?? '')}
          onKeyDown={(event) => event.key === 'Enter' && addText()}
        />
        <DialogFooter>
          <PrimaryButton text={dialogTitle} disabled={newTextName.trim() === ''} onClick={addText} />
          <DefaultButton text={strings.Cancel} onClick={() => setElementDialog(undefined)} />
        </DialogFooter>
      </Dialog>
    </>
  );
};
