// Feltételszerkesztő a tervezőhöz: vizuális sorok (mező, operátor, érték), összetett feltételnél JSON.
// A vizuális modell átalakítása az engine/ConditionModel.ts-ben van.

import * as React from 'react';
import { ActionButton, IconButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { Link } from '@fluentui/react/lib/Link';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { ATTACHMENTS_FIELD } from '../engine/Attachments';
import { validateCondition } from '../engine/ConditionEngine';
import {
  changeRowOperator,
  ConditionItem,
  ConditionMatch,
  createEmptyGroup,
  createEmptyRow,
  fromConditionRows,
  IConditionRow,
  IConditionRows,
  isConditionGroup,
  operatorNeedsValue,
  splitValues,
  toConditionRows
} from '../engine/ConditionModel';
import { IFieldSchema } from '../models/IFieldSchema';
import { Condition, CONDITION_OPERATORS, ConditionOperator } from '../models/IFormConfig';

const classes = mergeStyleSets({
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rows: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 8,
    border: '1px solid #edebe9',
    borderRadius: 2,
    background: '#faf9f8'
  },
  rowLine: { display: 'flex', alignItems: 'flex-start', gap: 4 },
  grow: { flex: 1, minWidth: 0 },
  operator: { flex: '0 0 42%', minWidth: 0 },
  hint: { fontSize: 12, color: '#605e5c' },
  add: { height: 28, padding: 0 },
  addRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  // Beágyazott csoport: bal oldali sávval, hogy a szintek elkülönüljenek.
  group: { padding: '6px 0 6px 10px', borderLeft: '3px solid #c7e0f4', display: 'flex', flexDirection: 'column', gap: 4 },
  groupHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  groupTitle: { fontSize: 12, fontWeight: 600, color: '#605e5c' }
});

/** Az operátorok felirata. Függvény, mert a szövegek csak futáskor állnak biztosan rendelkezésre. */
function operatorLabels(): Record<ConditionOperator, string> {
  return {
    eq: strings.ConditionOpEq,
    ne: strings.ConditionOpNe,
    gt: strings.ConditionOpGt,
    lt: strings.ConditionOpLt,
    contains: strings.ConditionOpContains,
    in: strings.ConditionOpIn,
    empty: strings.ConditionOpEmpty,
    notEmpty: strings.ConditionOpNotEmpty
  };
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

interface IJsonEditorProps {
  label: string;
  value: Condition | undefined;
  onChange: (value: Condition | undefined) => void;
}

/** A feltétel JSON-ként; a konfigurációba csak érvényes feltétel kerül. */
const JsonConditionEditor: React.FC<IJsonEditorProps> = (props) => {
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
      ariaLabel={props.label}
      multiline
      autoAdjustHeight
      rows={2}
      value={text}
      errorMessage={error}
      description={strings.ConditionHelp}
      styles={{ field: { fontFamily: 'Consolas, Menlo, monospace', fontSize: 12 } }}
      onChange={(_, next) => onTextChange(next ?? '')}
    />
  );
};

interface IRowEditorProps {
  row: IConditionRow;
  schema: IFieldSchema[];
  onChange: (row: IConditionRow) => void;
  onRemove: () => void;
}

const RowEditor: React.FC<IRowEditorProps> = ({ row, schema, onChange, onRemove }) => {
  const fieldSchema: IFieldSchema | undefined = schema.filter((item) => item.InternalName === row.field)[0];
  const labels: Record<ConditionOperator, string> = operatorLabels();

  const fieldOptions: IDropdownOption[] = schema
    // A mellékletek nem mezőérték, feltétel nem épülhet rájuk.
    .filter((item) => item.TypeAsString !== ATTACHMENTS_FIELD)
    .map((item) => ({ key: item.InternalName, text: `${item.Title} (${item.InternalName})` }));
  if (row.field !== '' && !fieldSchema) {
    fieldOptions.push({ key: row.field, text: row.field });
  }

  const choices: string[] | undefined =
    fieldSchema && (fieldSchema.TypeAsString === 'Choice' || fieldSchema.TypeAsString === 'MultiChoice')
      ? fieldSchema.Choices
      : undefined;

  // Az érték módosításakor az eredeti (típusos) érték érvényét veszti.
  const setText = (text: string): void => onChange({ field: row.field, op: row.op, text, values: row.op === 'in' ? splitValues(text) : [] });
  const setValues = (values: string[]): void => onChange({ field: row.field, op: row.op, text: values.join(', '), values });

  let valueControl: JSX.Element | undefined;
  if (!operatorNeedsValue(row.op)) {
    valueControl = undefined;
  } else if (choices && row.op === 'in') {
    const options: IDropdownOption[] = choices.concat(row.values.filter((value) => choices.indexOf(value) === -1)).map((choice) => ({
      key: choice,
      text: choice
    }));
    valueControl = (
      <Dropdown
        className={classes.grow}
        ariaLabel={strings.ConditionValue}
        placeholder={strings.ConditionValue}
        multiSelect
        options={options}
        selectedKeys={row.values}
        onChange={(_, option) => {
          if (option) {
            const key: string = String(option.key);
            setValues(option.selected ? [...row.values, key] : row.values.filter((value) => value !== key));
          }
        }}
      />
    );
  } else if (choices && row.op !== 'gt' && row.op !== 'lt') {
    const options: IDropdownOption[] = (row.text !== '' && choices.indexOf(row.text) === -1 ? [...choices, row.text] : choices).map(
      (choice) => ({ key: choice, text: choice })
    );
    valueControl = (
      <Dropdown
        className={classes.grow}
        ariaLabel={strings.ConditionValue}
        placeholder={strings.ConditionValue}
        options={options}
        selectedKey={row.text === '' ? null : row.text}
        onChange={(_, option) => option && setText(String(option.key))}
      />
    );
  } else if (fieldSchema?.TypeAsString === 'Boolean' && (row.op === 'eq' || row.op === 'ne')) {
    valueControl = (
      <Dropdown
        className={classes.grow}
        ariaLabel={strings.ConditionValue}
        placeholder={strings.ConditionValue}
        options={[
          { key: 'true', text: strings.Yes },
          { key: 'false', text: strings.No }
        ]}
        selectedKey={row.text === 'true' || row.text === 'false' ? row.text : null}
        onChange={(_, option) => option && setText(String(option.key))}
      />
    );
  } else {
    valueControl = (
      <TextField
        className={classes.grow}
        ariaLabel={strings.ConditionValue}
        placeholder={row.op === 'in' ? strings.ConditionValuesPlaceholder : strings.ConditionValue}
        value={row.text}
        onChange={(_, next) => setText(next ?? '')}
      />
    );
  }

  return (
    <div className={classes.row}>
      <div className={classes.rowLine}>
        <Dropdown
          className={classes.grow}
          ariaLabel={strings.Field}
          placeholder={strings.ConditionFieldPlaceholder}
          options={fieldOptions}
          selectedKey={row.field === '' ? null : row.field}
          // Másik mezőnél a korábbi érték már nem biztos, hogy értelmes, de megtartjuk: a szerkesztő dönt.
          onChange={(_, option) => option && onChange({ ...row, field: String(option.key) })}
        />
        <IconButton iconProps={{ iconName: 'Cancel' }} title={strings.ConditionRemove} ariaLabel={strings.ConditionRemove} onClick={onRemove} />
      </div>
      <div className={classes.rowLine}>
        <Dropdown
          className={valueControl ? classes.operator : classes.grow}
          ariaLabel={strings.ConditionOperator}
          options={CONDITION_OPERATORS.map((op) => ({ key: op, text: labels[op] }))}
          selectedKey={row.op}
          onChange={(_, option) => option && onChange(changeRowOperator(row, option.key as ConditionOperator))}
        />
        {valueControl}
      </div>
    </div>
  );
};

/** Ennyi szint mélységig vehető fel újabb csoport (a JSON-ban ennél mélyebb is lehet). */
const MAX_GROUP_DEPTH: number = 3;

interface IItemsEditorProps {
  match: ConditionMatch;
  items: ConditionItem[];
  schema: IFieldSchema[];
  /** A beágyazás szintje: 0 a feltétel gyökere. */
  depth: number;
  onChange: (match: ConditionMatch, items: ConditionItem[]) => void;
}

/** Egy szint elemei (sorok és beágyazott csoportok), a kapcsolatuk választójával és a hozzáadó gombokkal. */
const ItemsEditor: React.FC<IItemsEditorProps> = ({ match, items, schema, depth, onChange }) => {
  const replace = (index: number, item: ConditionItem): void => onChange(match, items.map((current, i) => (i === index ? item : current)));
  const remove = (index: number): void => onChange(match, items.filter((_, i) => i !== index));
  return (
    <div className={classes.rows}>
      {items.length > 1 && (
        <Dropdown
          ariaLabel={strings.ConditionMatch}
          options={[
            { key: 'all', text: strings.ConditionMatchAll },
            { key: 'any', text: strings.ConditionMatchAny }
          ]}
          selectedKey={match}
          onChange={(_, option) => option && onChange(option.key as ConditionMatch, items)}
        />
      )}
      {items.map((item, index) =>
        isConditionGroup(item) ? (
          <div key={index} className={classes.group}>
            <div className={classes.groupHeader}>
              <span className={classes.groupTitle}>{strings.ConditionGroup}</span>
              <IconButton
                iconProps={{ iconName: 'Cancel' }}
                title={strings.ConditionGroupRemove}
                ariaLabel={strings.ConditionGroupRemove}
                onClick={() => remove(index)}
              />
            </div>
            <ItemsEditor
              match={item.match}
              items={item.rows}
              schema={schema}
              depth={depth + 1}
              onChange={(nextMatch, rows) => replace(index, { ...item, match: nextMatch, rows })}
            />
          </div>
        ) : (
          <RowEditor key={index} row={item} schema={schema} onChange={(next) => replace(index, next)} onRemove={() => remove(index)} />
        )
      )}
      <div className={classes.addRow}>
        <ActionButton
          className={classes.add}
          iconProps={{ iconName: 'Add' }}
          text={strings.ConditionAdd}
          onClick={() => onChange(match, [...items, createEmptyRow()])}
        />
        {depth < MAX_GROUP_DEPTH && (
          <ActionButton
            className={classes.add}
            iconProps={{ iconName: 'BulletedTreeList' }}
            text={strings.ConditionAddGroup}
            // Az új csoport a szint kapcsolatának ellentétével indul (ÉS alatt VAGY és fordítva), ez a gyakoribb.
            onClick={() => onChange(match, [...items, createEmptyGroup(match === 'all' ? 'any' : 'all')])}
          />
        )}
      </div>
    </div>
  );
};

export interface IConditionEditorProps {
  label: string;
  value: Condition | undefined;
  /** A lista mezői: ezekre épülhet feltétel. */
  schema: IFieldSchema[];
  onChange: (value: Condition | undefined) => void;
}

export const ConditionEditor: React.FC<IConditionEditorProps> = (props) => {
  const { value, schema } = props;
  const typeOf = (field: string): string | undefined => schema.filter((item) => item.InternalName === field)[0]?.TypeAsString;

  const initial: IConditionRows | undefined = toConditionRows(value);
  const [model, setModel] = React.useState<IConditionRows>(initial ?? { match: 'all', rows: [] });
  // Összetett (vizuálisan nem szerkeszthető) feltétel csak JSON-ként jelenik meg.
  const [jsonMode, setJsonMode] = React.useState<boolean>(initial === undefined);
  // Az általunk utoljára kiadott feltétel: ha a kapott érték ettől eltér, kívülről változott.
  const lastEmitted = React.useRef<string>(JSON.stringify(value));

  React.useEffect(() => {
    const incoming: string = JSON.stringify(value);
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      const rows: IConditionRows | undefined = toConditionRows(value);
      if (rows) {
        setModel(rows);
      } else {
        setJsonMode(true);
      }
    }
  }, [value]);

  const emit = (condition: Condition | undefined): void => {
    lastEmitted.current = JSON.stringify(condition);
    props.onChange(condition);
  };

  const update = (next: IConditionRows): void => {
    setModel(next);
    emit(fromConditionRows(next, typeOf));
  };

  const representable: boolean = toConditionRows(value) !== undefined;

  const switchMode = (): void => {
    if (jsonMode) {
      // Visszaváltáskor a sorokat az aktuális feltételből építjük újra.
      setModel(toConditionRows(value) ?? { match: 'all', rows: [] });
    }
    setJsonMode(!jsonMode);
  };

  const header: JSX.Element = (
    <div className={classes.header}>
      <Label>{props.label}</Label>
      {(!jsonMode || representable) && <Link onClick={switchMode}>{jsonMode ? strings.ConditionVisualMode : strings.ConditionJsonMode}</Link>}
    </div>
  );

  if (jsonMode) {
    return (
      <div>
        {header}
        {!representable && <div className={classes.hint}>{strings.ConditionComplex}</div>}
        <JsonConditionEditor
          label={props.label}
          value={value}
          onChange={(condition) => {
            lastEmitted.current = JSON.stringify(condition);
            props.onChange(condition);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {header}
      <ItemsEditor
        match={model.match}
        items={model.rows}
        schema={schema}
        depth={0}
        onChange={(match, rows) => update({ match, rows })}
      />
    </div>
  );
};
