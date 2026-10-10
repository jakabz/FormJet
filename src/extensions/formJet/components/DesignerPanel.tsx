// Admin tervező (Elrendezés / Mező / JSON fülek).
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

import { validateCondition } from '../engine/ConditionEngine';
import { parseConfig, unplacedFields } from '../engine/LayoutResolver';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  Condition,
  FORM_MODES,
  FormMode,
  IFieldConfig,
  IFieldPlacement,
  IFormConfig,
  ISectionConfig
} from '../models/IFormConfig';

export type DesignerTab = 'layout' | 'field' | 'json';

const MODE_LABELS: Record<FormMode, string> = { new: 'Új', edit: 'Szerkesztés', display: 'Megtekintés' };

const CONDITION_HELP: string =
  'JSON feltétel, például: { "field": "Amount", "op": "gt", "value": 500000 }. ' +
  'Operátorok: eq, ne (egyenlő / nem egyenlő), gt, lt (nagyobb / kisebb), contains (tartalmazza), ' +
  'in (benne van a "value" tömbben), empty, notEmpty (üres / nem üres). ' +
  'Csoportosítás: { "all": [...] }, { "any": [...] }, { "not": {...} }. A "field" a mező belső neve.';

const COLUMN_OPTIONS: IDropdownOption[] = [1, 2, 3, 4].map((n) => ({ key: n, text: String(n) }));

const classes = mergeStyleSets({
  tab: { paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  card: { border: '1px solid #edebe9', borderRadius: 4, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 4 },
  cardTitle: { flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
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
      setError('Hibás JSON.');
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

  React.useEffect(() => {
    setJsonText(JSON.stringify(draft, undefined, 2));
    setJsonError(undefined);
  }, [draft]);

  const titleOf = (name: string): string => {
    const field: IFieldSchema | undefined = schema.find((f) => f.InternalName === name);
    return field ? `${field.Title} (${name})` : `${name} – nem létező mező`;
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
      sections: [...draft.sections, { id: `section-${n}`, title: 'Új szekció', columns: 1, fields: [] }]
    });
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
    <div key={section.id} className={classes.card}>
      <div className={classes.cardHeader}>
        <span className={classes.cardTitle}>{section.title || section.id}</span>
        <IconButton
          iconProps={{ iconName: 'Up' }}
          title="Szekció feljebb"
          disabled={index === 0}
          onClick={() => props.onChange({ ...draft, sections: move(draft.sections, index, index - 1) })}
        />
        <IconButton
          iconProps={{ iconName: 'Down' }}
          title="Szekció lejjebb"
          disabled={index === draft.sections.length - 1}
          onClick={() => props.onChange({ ...draft, sections: move(draft.sections, index, index + 1) })}
        />
        <IconButton
          iconProps={{ iconName: 'Delete' }}
          title="Szekció törlése (a mezői a nem elhelyezettek közé kerülnek)"
          onClick={() => props.onChange({ ...draft, sections: draft.sections.filter((_, i) => i !== index) })}
        />
      </div>
      <TextField label="Cím" value={section.title ?? ''} onChange={(_, v) => updateSection(index, { title: v })} />
      <TextField
        label="Leírás"
        value={section.description ?? ''}
        onChange={(_, v) => updateSection(index, { description: v })}
      />
      <Dropdown
        label="Oszlopok száma"
        options={COLUMN_OPTIONS}
        selectedKey={section.columns}
        onChange={(_, option) => option && updateSection(index, { columns: Number(option.key) })}
      />
      <div className={classes.modes}>
        <Checkbox
          label="Becsukható"
          checked={!!section.collapsible}
          onChange={(_, checked) =>
            updateSection(index, { collapsible: checked || undefined, collapsed: checked ? section.collapsed : undefined })
          }
        />
        <Checkbox
          label="Alapból csukva"
          disabled={!section.collapsible}
          checked={!!section.collapsed}
          onChange={(_, checked) => updateSection(index, { collapsed: checked || undefined })}
        />
      </div>
      <ModeCheckboxes
        label="Látható ezekben a módokban"
        value={section.visibleIn}
        missingMeansAll
        onChange={(visibleIn) => updateSection(index, { visibleIn })}
      />
      <ConditionEditor
        label="Látható, ha"
        value={section.visibleWhen}
        onChange={(visibleWhen) => updateSection(index, { visibleWhen })}
      />

      <Label>Mezők</Label>
      {section.fields.length === 0 && <div className={classes.hint}>A szekció üres.</div>}
      {section.fields.map((placement, i) => (
        <div key={placement.field} className={classes.row}>
          <span
            className={classes.rowName}
            title="Mező beállításai"
            onClick={() => {
              props.onSelectField(placement.field);
              props.onTabChange('field');
            }}
          >
            {titleOf(placement.field)}
          </span>
          <Dropdown
            className={classes.spanDropdown}
            title="Szélesség (oszlop)"
            ariaLabel="Szélesség (oszlop)"
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
            title="Mező feljebb"
            disabled={i === 0}
            onClick={() => updatePlacements(index, move(section.fields, i, i - 1))}
          />
          <IconButton
            iconProps={{ iconName: 'Down' }}
            title="Mező lejjebb"
            disabled={i === section.fields.length - 1}
            onClick={() => updatePlacements(index, move(section.fields, i, i + 1))}
          />
          <IconButton
            iconProps={{ iconName: 'Cancel' }}
            title="Eltávolítás a szekcióból"
            onClick={() => updatePlacements(index, section.fields.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {unplacedOptions.length > 0 && (
        <Dropdown
          placeholder="Mező hozzáadása…"
          ariaLabel="Mező hozzáadása"
          options={unplacedOptions}
          selectedKey={null}
          onChange={(_, option) => option && updatePlacements(index, [...section.fields, { field: String(option.key) }])}
        />
      )}
    </div>
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
          label="Mező"
          placeholder="Válassz mezőt, vagy kattints rá az előnézetben"
          options={fieldOptions}
          selectedKey={selectedField ?? null}
          onChange={(_, option) => props.onSelectField(option ? String(option.key) : undefined)}
        />
        {selectedField && fieldSchema && (
          <>
            <div className={classes.hint}>
              Típus: {fieldSchema.TypeAsString}
              {fieldSchema.Required ? ' · a SharePoint szerint kötelező' : ''}
              {fieldSchema.ReadOnlyField ? ' · a SharePoint szerint csak olvasható' : ''}
            </div>
            <TextField
              label="Címke"
              placeholder={fieldSchema.Title}
              value={config.label ?? ''}
              onChange={(_, v) => updateField(selectedField, { label: v })}
            />
            <TextField
              label="Leírás"
              placeholder={fieldSchema.Description}
              value={config.description ?? ''}
              onChange={(_, v) => updateField(selectedField, { description: v })}
            />
            <TextField
              label="Helykitöltő szöveg"
              value={config.placeholder ?? ''}
              onChange={(_, v) => updateField(selectedField, { placeholder: v })}
            />
            <TextField
              label="Kezdőérték új elemnél"
              description="Form-string formátumban, pl. több választásnál: ;#A;#B;#, igen/nem mezőnél: 1 vagy 0."
              value={config.defaultValue ?? ''}
              onChange={(_, v) => updateField(selectedField, { defaultValue: v })}
            />
            <ModeCheckboxes
              label="Látható ezekben a módokban"
              value={config.visibleIn}
              missingMeansAll
              onChange={(visibleIn) => updateField(selectedField, { visibleIn })}
            />
            <ModeCheckboxes
              label="Csak olvasható ezekben a módokban"
              value={config.readOnlyIn}
              missingMeansAll={false}
              onChange={(readOnlyIn) => updateField(selectedField, { readOnlyIn })}
            />
            <ModeCheckboxes
              label="Kötelező ezekben a módokban"
              value={config.requiredIn}
              missingMeansAll={false}
              onChange={(requiredIn) => updateField(selectedField, { requiredIn })}
            />
            <div className={classes.hint}>
              A kötelezőség csak szigorítható: a SharePoint szerint kötelező mező itt nem tehető opcionálissá.
            </div>
            <ConditionEditor
              label="Látható, ha"
              value={config.visibleWhen}
              onChange={(visibleWhen) => updateField(selectedField, { visibleWhen })}
            />
            <ConditionEditor
              label="Csak olvasható, ha"
              value={config.readOnlyWhen}
              onChange={(readOnlyWhen) => updateField(selectedField, { readOnlyWhen })}
            />
            <ConditionEditor
              label="Kötelező, ha"
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
      <PivotItem headerText="Elrendezés" itemKey="layout">
        <div className={classes.tab}>
          <TextField
            label="A form címe"
            value={draft.title ?? ''}
            onChange={(_, v) => props.onChange(compact({ ...draft, title: v }))}
          />
          {draft.sections.map(renderSection)}
          <DefaultButton iconProps={{ iconName: 'Add' }} text="Új szekció" onClick={addSection} />
          <div>
            <Label>Nem elhelyezett mezők</Label>
            <div className={classes.hint}>
              {unplaced.length === 0
                ? 'Minden mező el van helyezve.'
                : 'Ezek a mezők nem jelennek meg a formon: ' + unplaced.map((f) => f.Title).join(', ')}
            </div>
          </div>
        </div>
      </PivotItem>
      <PivotItem headerText="Mező" itemKey="field">
        {renderFieldTab()}
      </PivotItem>
      <PivotItem headerText="JSON" itemKey="json">
        <div className={classes.tab}>
          {jsonError && <MessageBar messageBarType={MessageBarType.error}>{jsonError}</MessageBar>}
          <TextField
            ariaLabel="Konfiguráció JSON"
            multiline
            rows={24}
            value={jsonText}
            styles={{ field: { fontFamily: 'Consolas, Menlo, monospace', fontSize: 12 } }}
            onChange={(_, v) => setJsonText(v ?? '')}
          />
          <PrimaryButton text="Alkalmaz" onClick={applyJson} />
        </div>
      </PivotItem>
    </Pivot>
  );
};
