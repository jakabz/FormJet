// Admin tervező (Elrendezés / Mező / Stílus / JSON fülek).
// Csak a draft konfigurációt módosítja az onChange-en keresztül, immutábilisan.
// SharePointba nem ír; a mentés a FormHost.saveDesign dolga.

import * as React from 'react';
import { DefaultButton, IconButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { ATTACHMENTS_FIELD } from '../engine/Attachments';
import { format } from '../engine/EngineStrings';
import { parseConfig, unplacedFields } from '../engine/LayoutResolver';
import { addTextElement, isTextElement, removeTextElement } from '../engine/TextElement';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  AttachmentsDisplay,
  FORM_MODES,
  FormMode,
  IFieldConfig,
  IFieldPlacement,
  IFormConfig,
  ISectionConfig,
  ITextElement,
  LOOKUP_CHECKLIST_MAX,
  LookupDisplay
} from '../models/IFormConfig';
import { AccordionCard } from './AccordionCard';
import { ConditionEditor } from './ConditionEditor';
import { RelatedListEditor } from './RelatedListEditor';
import { StylePanel } from './StylePanel';

export type DesignerTab = 'layout' | 'field' | 'style' | 'json';

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
  addText: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  addTextName: { flex: 1, minWidth: 0 },
  spanDropdown: { width: 64 }
});

export interface IDesignerPanelProps {
  draft: IFormConfig;
  schema: IFieldSchema[];
  tab: DesignerTab;
  onTabChange: (tab: DesignerTab) => void;
  selectedField?: string;
  onSelectField: (name: string | undefined) => void;
  onChange: (draft: IFormConfig) => void;
  /** A még el nem helyezett mezők behúzható listája (a húzd-és-ejtsd felülettől); hiányában szöveges felsorolás látszik. */
  unplacedPalette?: React.ReactNode;
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
  const { draft, schema, selectedField } = props;
  const [jsonText, setJsonText] = React.useState<string>('');
  const [jsonError, setJsonError] = React.useState<string | undefined>();
  // Az Elrendezés fülön egyszerre egy szekciókártya van nyitva; alapból az első.
  const [openSection, setOpenSection] = React.useState<string | undefined>(draft.sections[0]?.id);
  const [newTextName, setNewTextName] = React.useState<string>('');

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
    setOpenSection(`section-${n}`);
  };

  const updateField = (name: string, patch: Partial<IFieldConfig>): void => {
    const field: IFieldConfig = compact({ ...(draft.fields[name] ?? {}), ...patch });
    props.onChange({ ...draft, fields: { ...draft.fields, [name]: field } });
  };

  const updateText = (id: string, patch: Partial<ITextElement>): void => {
    const current: ITextElement = draft.texts?.[id] ?? { name: '' };
    const text: ITextElement = { ...current, ...patch };
    if (text.content === undefined) {
      delete text.content;
    }
    props.onChange({ ...draft, texts: { ...(draft.texts ?? {}), [id]: text } });
  };

  /** Új szövegelem a megadott megnevezéssel, a nyitott (ennek hiányában az utolsó) szekció végére. */
  const addText = (): void => {
    const added = addTextElement(draft, newTextName.trim(), openSection);
    props.onChange(added.config);
    setNewTextName('');
    // A tartalom a Mező fülön adható meg.
    props.onSelectField(added.id);
    props.onTabChange('field');
  };

  // A feltételek és a kapcsolódó elemek csak valódi mezőre hivatkozhatnak; a szövegelemnek nincs értéke.
  const realFields: IFieldSchema[] = schema.filter((f) => !isTextElement(f));

  const unplaced: IFieldSchema[] = unplacedFields(schema, draft);
  const unplacedOptions: IDropdownOption[] = unplaced.map((f) => ({
    key: f.InternalName,
    text: `${f.Title} (${f.InternalName})`
  }));

  const renderSection = (section: ISectionConfig, index: number): JSX.Element => (
    <AccordionCard
      key={section.id}
      title={section.title || section.id}
      open={openSection === section.id}
      onToggle={() => setOpenSection(openSection === section.id ? undefined : section.id)}
      actions={
        <>
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
            onClick={() => props.onChange({ ...draft, sections: draft.sections.filter((_, i) => i !== index) })}
          />
        </>
      }
    >
      <TextField label={strings.SectionTitle} value={section.title ?? ''} onChange={(_, v) => updateSection(index, { title: v })} />
      <TextField
        label={strings.Description}
        value={section.description ?? ''}
        onChange={(_, v) => updateSection(index, { description: v })}
      />
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
        schema={realFields}
        label={strings.VisibleWhen}
        value={section.visibleWhen}
        onChange={(visibleWhen) => updateSection(index, { visibleWhen })}
      />
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
            onClick={() => {
              props.onSelectField(placement.field);
              props.onTabChange('field');
            }}
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
    </AccordionCard>
  );

  const renderFieldTab = (): JSX.Element => {
    const fieldOptions: IDropdownOption[] = schema.map((f) => ({
      key: f.InternalName,
      text: `${f.Title} (${f.InternalName})`
    }));
    const fieldSchema: IFieldSchema | undefined = schema.find((f) => f.InternalName === selectedField);
    const config: IFieldConfig = (selectedField && draft.fields[selectedField]) || {};
    return (
      <div className={classes.tab}>
        <Dropdown
          label={strings.Field}
          placeholder={strings.FieldPickerPlaceholder}
          options={fieldOptions}
          selectedKey={selectedField ?? null}
          onChange={(_, option) => props.onSelectField(option ? String(option.key) : undefined)}
        />
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
              schema={realFields}
              label={strings.VisibleWhen}
              value={config.visibleWhen}
              onChange={(visibleWhen) => updateField(selectedField, { visibleWhen })}
            />
            <DefaultButton
              iconProps={{ iconName: 'Delete' }}
              text={strings.TextElementDelete}
              onClick={() => {
                props.onChange(removeTextElement(draft, selectedField));
                props.onSelectField(undefined);
              }}
            />
          </>
        )}
        {selectedField && fieldSchema && !isTextElement(fieldSchema) && (
          <>
            <div className={classes.hint}>
              {format(strings.FieldType, fieldSchema.TypeAsString)}
              {fieldSchema.Required ? ' · ' + strings.SpRequired : ''}
              {fieldSchema.ReadOnlyField ? ' · ' + strings.SpReadOnly : ''}
            </div>
            <TextField
              label={strings.FieldLabel}
              placeholder={fieldSchema.Title}
              value={config.label ?? ''}
              onChange={(_, v) => updateField(selectedField, { label: v })}
            />
            <TextField
              label={strings.Description}
              placeholder={fieldSchema.Description}
              value={config.description ?? ''}
              onChange={(_, v) => updateField(selectedField, { description: v })}
            />
            <TextField
              label={strings.PlaceholderText}
              value={config.placeholder ?? ''}
              onChange={(_, v) => updateField(selectedField, { placeholder: v })}
            />
            <TextField
              label={strings.DefaultValue}
              description={strings.DefaultValueHint}
              value={config.defaultValue ?? ''}
              onChange={(_, v) => updateField(selectedField, { defaultValue: v })}
            />
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
              schema={realFields}
              label={strings.VisibleWhen}
              value={config.visibleWhen}
              onChange={(visibleWhen) => updateField(selectedField, { visibleWhen })}
            />
            <ConditionEditor
              key={`${selectedField}:ReadOnlyWhen`}
              schema={realFields}
              label={strings.ReadOnlyWhen}
              value={config.readOnlyWhen}
              onChange={(readOnlyWhen) => updateField(selectedField, { readOnlyWhen })}
            />
            <ConditionEditor
              key={`${selectedField}:RequiredWhen`}
              schema={realFields}
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

  return (
    <Pivot
      selectedKey={props.tab}
      onLinkClick={(item) => item?.props.itemKey && props.onTabChange(item.props.itemKey as DesignerTab)}
    >
      <PivotItem headerText={strings.TabLayout} itemKey="layout">
        <div className={classes.tab}>
          <TextField
            label={strings.FormTitle}
            value={draft.title ?? ''}
            onChange={(_, v) => props.onChange(compact({ ...draft, title: v }))}
          />
          <div>
            <Label>{strings.UnplacedFields}</Label>
            {unplaced.length > 0 && props.unplacedPalette ? (
              props.unplacedPalette
            ) : (
              <div className={classes.hint}>
                {unplaced.length === 0
                  ? strings.AllFieldsPlaced
                  : format(strings.UnplacedFieldsList, unplaced.map((f) => f.Title).join(', '))}
              </div>
            )}
          </div>
          <div className={classes.addText}>
            <TextField
              className={classes.addTextName}
              label={strings.TextElementNewName}
              value={newTextName}
              onChange={(_, v) => setNewTextName(v ?? '')}
            />
            <DefaultButton
              iconProps={{ iconName: 'InsertTextBox' }}
              text={strings.TextElementAdd}
              disabled={newTextName.trim() === ''}
              onClick={addText}
            />
          </div>
          {draft.sections.map(renderSection)}
          <DefaultButton iconProps={{ iconName: 'Add' }} text={strings.NewSection} onClick={addSection} />
        </div>
      </PivotItem>
      <PivotItem headerText={strings.TabField} itemKey="field">
        {renderFieldTab()}
      </PivotItem>
      <PivotItem headerText={strings.TabStyle} itemKey="style">
        <StylePanel
          draft={draft}
          schema={schema}
          selectedField={selectedField}
          onSelectField={props.onSelectField}
          onChange={props.onChange}
        />
      </PivotItem>
      <PivotItem headerText={strings.TabJson} itemKey="json">
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
    </Pivot>
  );
};
