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

import { validateCondition } from '../engine/ConditionEngine';
import { format } from '../engine/EngineStrings';
import { parseConfig, unplacedFields } from '../engine/LayoutResolver';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  Condition,
  FORM_MODES,
  FormMode,
  IFieldConfig,
  IFieldPlacement,
  IFormConfig,
  ISectionConfig,
  LOOKUP_CHECKLIST_MAX,
  LookupDisplay
} from '../models/IFormConfig';
import { AccordionCard } from './AccordionCard';
import { RelatedListEditor } from './RelatedListEditor';
import { StylePanel } from './StylePanel';

export type DesignerTab = 'layout' | 'field' | 'style' | 'json';

const MODE_LABELS: Record<FormMode, string> = {
  new: strings.ModeNew,
  edit: strings.ModeEdit,
  display: strings.ModeDisplay
};

const CONDITION_HELP: string = strings.ConditionHelp;

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

interface IConditionEditorProps {
  label: string;
  value: Condition | undefined;
  onChange: (value: Condition | undefined) => void;
}

function conditionToText(value: Condition | undefined): string {
  return value ? JSON.stringify(value, undefined, 2) : '';
}

function tryParse(text: string): unknown {
  try {
    return text.trim() === '' ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}

const ConditionEditor: React.FC<IConditionEditorProps> = (props) => {
  const [text, setText] = React.useState<string>(conditionToText(props.value));
  const [error, setError] = React.useState<string | undefined>();

  // Ha a feltétel kívülről változik (másik mező, JSON fül), a szöveget hozzá igazítjuk.
  React.useEffect(() => {
    if (JSON.stringify(tryParse(text)) !== JSON.stringify(props.value)) {
      setText(conditionToText(props.value));
      setError(undefined);
    }
  }, [props.value]);

  const onTextChange = (next: string): void => {
    setText(next);
    if (next.trim() === '') {
      setError(undefined);
      props.onChange(undefined);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch {
      setError(strings.InvalidJsonShort);
      return;
    }
    const validationError: string | undefined = validateCondition(parsed);
    setError(validationError);
    if (!validationError) {
      props.onChange(parsed as Condition);
    }
  };

  return (
    <TextField
      label={props.label}
      multiline
      autoAdjustHeight
      rows={2}
      value={text}
      errorMessage={error}
      description={CONDITION_HELP}
      styles={{ field: { fontFamily: 'Consolas, Menlo, monospace', fontSize: 12 } }}
      onChange={(_, next) => onTextChange(next ?? '')}
    />
  );
};

export const DesignerPanel: React.FC<IDesignerPanelProps> = (props) => {
  const { draft, schema, selectedField } = props;
  const [jsonText, setJsonText] = React.useState<string>('');
  const [jsonError, setJsonError] = React.useState<string | undefined>();
  // Az Elrendezés fülön egyszerre egy szekciókártya van nyitva; alapból az első.
  const [openSection, setOpenSection] = React.useState<string | undefined>(draft.sections[0]?.id);

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
        label={strings.VisibleWhen}
        value={section.visibleWhen}
        onChange={(visibleWhen) => updateSection(index, { visibleWhen })}
      />
      <RelatedListEditor
        value={section.related}
        schema={schema}
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
        {selectedField && fieldSchema && (
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
              label={strings.VisibleWhen}
              value={config.visibleWhen}
              onChange={(visibleWhen) => updateField(selectedField, { visibleWhen })}
            />
            <ConditionEditor
              label={strings.ReadOnlyWhen}
              value={config.readOnlyWhen}
              onChange={(readOnlyWhen) => updateField(selectedField, { readOnlyWhen })}
            />
            <ConditionEditor
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
          {draft.sections.map(renderSection)}
          <DefaultButton iconProps={{ iconName: 'Add' }} text={strings.NewSection} onClick={addSection} />
          <div>
            <Label>{strings.UnplacedFields}</Label>
            <div className={classes.hint}>
              {unplaced.length === 0
                ? strings.AllFieldsPlaced
                : format(strings.UnplacedFieldsList, unplaced.map((f) => f.Title).join(', '))}
            </div>
          </div>
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
