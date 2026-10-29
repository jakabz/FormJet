// A beállító webpart menüpont-szerkesztője: egy lista helyi menüjébe kerülő FormJet menüpontok felvétele és beállítása.
// Mentéskor a konfiguráció a FormConfigurations listába kerül, és a FormJet helyi menü a listára kötődik (ha van
// menüpont), illetve lekerül róla (ha nincs).

import * as React from 'react';
import { ActionButton, DefaultButton, IconButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Icon } from '@fluentui/react/lib/Icon';
import { Label } from '@fluentui/react/lib/Label';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';
// Csak a beállító webpart csomagjába kerül (az ikonválasztó a PnP vezérlőkészletből, egyeztetett kivétel).
import { IconPicker } from '@pnp/spfx-controls-react/lib/IconPicker';

import * as strings from 'FormJetFormCustomizerStrings';

import { isButtonSettableField, isIconName } from '../engine/ButtonAction';
import { AUTHOR_VARIABLE, groupVariable } from '../engine/ConditionContext';
import { format } from '../engine/EngineStrings';
import { newCommandId } from '../engine/ListCommands';
import { ID_FIELD, isMatchableType } from '../engine/RelatedList';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  IFieldAssignment,
  IListCommand,
  IListCommandsConfig,
  LIST_COMMAND_SLOTS,
  ListCommandAction,
  ListCommandActionType
} from '../models/IListCommands';
import { IConfigRef } from '../services/ConfigService';
import * as GroupService from '../services/GroupService';
import * as ListCommandService from '../services/ListCommandService';
import * as RelatedListService from '../services/RelatedListService';
import * as SchemaService from '../services/SchemaService';
import { AccordionCard } from './AccordionCard';
import { ConditionEditor } from './ConditionEditor';

const classes = mergeStyleSets({
  root: { display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { fontSize: 12, color: '#605e5c' },
  iconRow: { display: 'flex', alignItems: 'center', gap: 8 },
  iconPreview: { fontSize: 20, width: 24, textAlign: 'center', color: '#323130' },
  step: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid #c8c6c4', borderRadius: 2 },
  stepHeader: { display: 'flex', alignItems: 'center', gap: 4 },
  stepTitle: { flex: 1, fontWeight: 600 },
  row: { display: 'flex', alignItems: 'flex-end', gap: 4 },
  grow: { flex: 1, minWidth: 0 },
  source: { width: 210, flexShrink: 0 },
  assignment: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 10px 10px',
    marginBottom: 8,
    border: '1px solid #edebe9',
    borderRadius: 2,
    background: '#faf9f8'
  },
  add: { height: 28, padding: 0 },
  actions: { display: 'flex', gap: 8, paddingTop: 8 }
});

function move<T>(items: T[], from: number, to: number): T[] {
  const next: T[] = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  return items.map((current, i) => (i === index ? item : current));
}

function newAction(type: ListCommandActionType): ListCommandAction {
  switch (type) {
    case 'setValue':
      return { type, field: '', value: '' };
    case 'updateItems':
      return { type, listId: '', matchField: '', sourceField: '', values: [] };
    default:
      return { type: 'createItem', listId: '', values: [] };
  }
}

/** Egy lista sémája (az alapértelmezett tartalomtípus szerint), gyorsítótárazva a szerkesztő idejére. */
const schemaCache: Record<string, Promise<IFieldSchema[]> | undefined> = {};
function getListSchema(listId: string): Promise<IFieldSchema[]> {
  if (!schemaCache[listId]) {
    const request: Promise<IFieldSchema[]> = SchemaService.resolveContentTypeId(listId, undefined).then((ct) =>
      SchemaService.getFields(listId, ct)
    );
    schemaCache[listId] = request;
    request.catch(() => {
      delete schemaCache[listId];
    });
  }
  return schemaCache[listId] as Promise<IFieldSchema[]>;
}

/** Egy lista sémája hookként (üres, amíg töltődik, vagy ha nincs lista kiválasztva). */
function useListSchema(listId: string): IFieldSchema[] {
  const [schema, setSchema] = React.useState<IFieldSchema[]>([]);
  React.useEffect(() => {
    let active: boolean = true;
    setSchema([]);
    if (listId) {
      getListSchema(listId)
        .then((fields) => active && setSchema(fields))
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [listId]);
  return schema;
}

function fieldOptions(fields: IFieldSchema[], current: string): IDropdownOption[] {
  const options: IDropdownOption[] = fields.map((field) => ({ key: field.InternalName, text: `${field.Title} (${field.InternalName})` }));
  if (current !== '' && !fields.some((field) => field.InternalName === current)) {
    options.push({ key: current, text: current });
  }
  return options;
}

/** A kijelölt elem mezőjére hivatkozó érték (`{InternalName}`); ilyenkor a mező értéke változatlanul kerül át. */
const FIELD_VALUE: RegExp = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

type ValueSource = 'constant' | 'field';

interface IValueInputProps {
  value: string;
  /** A kijelölt elem mezői, amelyek értéke átvehető. */
  sourceFields: IFieldSchema[];
  /** Feliratok (a lépésnél) vagy csak akadálymentes név (az értékadás soraiban). */
  showLabels: boolean;
  onChange: (value: string) => void;
}

/**
 * Egy érték megadása: megadott érték (konstans, [today], [me], szövegbe ágyazott {Mező} is), vagy a kijelölt elem egy
 * mezője listából választva. A mezőválasztás ugyanazt a `{Mező}` sablont menti, amit kézzel is be lehet írni.
 */
const ValueInput: React.FC<IValueInputProps> = ({ value, sourceFields, showLabels, onChange }) => {
  const match: RegExpMatchArray | null = value.trim().match(FIELD_VALUE);
  const [source, setSource] = React.useState<ValueSource>(match ? 'field' : 'constant');
  // Kívülről változó értéknél (sor törlése, átrendezése) a forrás az értékhez igazodik; az üres érték nem dönt.
  React.useEffect(() => {
    if (value.trim() !== '') {
      setSource(FIELD_VALUE.test(value.trim()) ? 'field' : 'constant');
    }
  }, [value]);
  return (
    <div className={classes.row}>
      <Dropdown
        className={classes.source}
        label={showLabels ? strings.CommandValueSource : undefined}
        ariaLabel={strings.CommandValueSource}
        options={[
          { key: 'constant', text: strings.CommandValueConstant },
          { key: 'field', text: strings.CommandValueFromItem }
        ]}
        selectedKey={source}
        onChange={(_, option) => {
          if (!option || option.key === source) {
            return;
          }
          setSource(option.key as ValueSource);
          // Forrásváltáskor a korábbi érték már nem illik az új forráshoz.
          onChange('');
        }}
      />
      {source === 'field' ? (
        <Dropdown
          className={classes.grow}
          label={showLabels ? strings.ButtonActionValue : undefined}
          ariaLabel={strings.ButtonActionValue}
          placeholder={strings.CommandValueFieldPlaceholder}
          dropdownWidth="auto"
          options={fieldOptions(sourceFields, match ? match[1] : '')}
          selectedKey={match ? match[1] : null}
          onChange={(_, option) => option && onChange(`{${String(option.key)}}`)}
        />
      ) : (
        <TextField
          className={classes.grow}
          label={showLabels ? strings.ButtonActionValue : undefined}
          ariaLabel={strings.ButtonActionValue}
          placeholder={strings.ButtonActionValue}
          value={value}
          onChange={(_, v) => onChange(v ?? '')}
        />
      )}
    </div>
  );
};

interface IAssignmentsEditorProps {
  listId: string;
  values: IFieldAssignment[];
  /** A kijelölt elem mezői (az értékek forrásához). */
  sourceFields: IFieldSchema[];
  onChange: (values: IFieldAssignment[]) => void;
}

/** A cél lista mezőinek értékadásai (mező + érték sablon). */
const AssignmentsEditor: React.FC<IAssignmentsEditorProps> = ({ listId, values, sourceFields, onChange }) => {
  const fields: IFieldSchema[] = useListSchema(listId).filter(isButtonSettableField);
  return (
    <div>
      <Label>{strings.CommandAssignments}</Label>
      {/* Értékadásonként egy kártya: felül a cél mező, alatta az érték forrása és maga az érték. */}
      {values.map((assignment, index) => (
        <div key={index} className={classes.assignment}>
          <div className={classes.row}>
            <Dropdown
              className={classes.grow}
              label={strings.CommandTargetField}
              placeholder={strings.CommandValueFieldPlaceholder}
              dropdownWidth="auto"
              options={fieldOptions(fields, assignment.field)}
              selectedKey={assignment.field === '' ? null : assignment.field}
              onChange={(_, option) => option && onChange(replaceAt(values, index, { ...assignment, field: String(option.key) }))}
            />
            <IconButton
              iconProps={{ iconName: 'Delete' }}
              title={strings.CommandAssignmentRemove}
              ariaLabel={strings.CommandAssignmentRemove}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            />
          </div>
          <ValueInput
            value={assignment.value}
            sourceFields={sourceFields}
            showLabels
            onChange={(value) => onChange(replaceAt(values, index, { ...assignment, value }))}
          />
        </div>
      ))}
      <ActionButton
        className={classes.add}
        iconProps={{ iconName: 'Add' }}
        text={strings.CommandAssignmentAdd}
        disabled={!listId}
        onClick={() => onChange([...values, { field: '', value: '' }])}
      />
      <div className={classes.hint}>{strings.CommandValueHint}</div>
    </div>
  );
};

interface IActionEditorProps {
  action: ListCommandAction;
  /** A menüpont listájának mezői (a kijelölt elem mezői). */
  schema: IFieldSchema[];
  lists: RelatedListService.IListInfo[];
  onChange: (action: ListCommandAction) => void;
}

const ActionEditor: React.FC<IActionEditorProps> = ({ action, schema, lists, onChange }) => {
  // Az értékek forrása: a kijelölt elem mezői és az azonosítója (a mellékletek nem form-string értékek).
  const sourceFields: IFieldSchema[] = React.useMemo(
    () =>
      [{ InternalName: ID_FIELD, Title: ID_FIELD, TypeAsString: 'Counter', Required: false, ReadOnlyField: true } as IFieldSchema].concat(
        schema.filter((field) => field.TypeAsString !== 'Attachments')
      ),
    [schema]
  );
  const listOptions: IDropdownOption[] = lists.map((list) => ({ key: list.id, text: list.title }));
  const targetListId: string = action.type === 'setValue' ? '' : action.listId;
  const [targetFields, setTargetFields] = React.useState<RelatedListService.IListFieldInfo[]>([]);
  React.useEffect(() => {
    setTargetFields([]);
    if (action.type === 'updateItems' && targetListId) {
      RelatedListService.getListFields(targetListId)
        .then(setTargetFields)
        .catch(() => undefined);
    }
  }, [action.type, targetListId]);

  if (action.type === 'setValue') {
    return (
      <>
        <Dropdown
          label={strings.ButtonActionField}
          placeholder={strings.ConditionFieldPlaceholder}
          dropdownWidth="auto"
          options={fieldOptions(schema.filter(isButtonSettableField), action.field)}
          selectedKey={action.field === '' ? null : action.field}
          onChange={(_, option) => option && onChange({ ...action, field: String(option.key) })}
        />
        <ValueInput value={action.value} sourceFields={sourceFields} showLabels onChange={(value) => onChange({ ...action, value })} />
        <div className={classes.hint}>{strings.CommandValueHint}</div>
      </>
    );
  }
  const listDropdown: JSX.Element = (
    <Dropdown
      label={strings.CommandTargetList}
      placeholder={strings.CommandTargetListPlaceholder}
      options={listOptions}
      selectedKey={action.listId === '' ? null : action.listId}
      // Másik listánál a korábbi mezők már nem érvényesek.
      onChange={(_, option) =>
        option &&
        onChange(
          action.type === 'updateItems'
            ? { ...action, listId: String(option.key), matchField: '', values: [] }
            : { ...action, listId: String(option.key), values: [] }
        )
      }
    />
  );
  if (action.type === 'createItem') {
    return (
      <>
        {listDropdown}
        <AssignmentsEditor
          listId={action.listId}
          values={action.values}
          sourceFields={sourceFields}
          onChange={(values) => onChange({ ...action, values })}
        />
      </>
    );
  }
  const matchOptions: IDropdownOption[] = targetFields
    .filter((field) => isMatchableType(field.type))
    .map((field) => ({ key: field.name, text: `${field.title} (${field.name})` }));
  const sourceOptions: IDropdownOption[] = [{ key: ID_FIELD, text: ID_FIELD }].concat(
    schema.filter((field) => isMatchableType(field.TypeAsString)).map((field) => ({ key: field.InternalName, text: `${field.Title} (${field.InternalName})` }))
  );
  return (
    <>
      {listDropdown}
      <Dropdown
        label={strings.CommandMatchField}
        options={matchOptions}
        selectedKey={action.matchField === '' ? null : action.matchField}
        onChange={(_, option) => option && onChange({ ...action, matchField: String(option.key) })}
      />
      <Dropdown
        label={strings.CommandSourceField}
        options={sourceOptions}
        selectedKey={action.sourceField === '' ? null : action.sourceField}
        onChange={(_, option) => option && onChange({ ...action, sourceField: String(option.key) })}
      />
      <div className={classes.hint}>{strings.CommandMatchHint}</div>
      <AssignmentsEditor
        listId={action.listId}
        values={action.values}
        sourceFields={sourceFields}
        onChange={(values) => onChange({ ...action, values })}
      />
    </>
  );
};

export interface IListCommandsEditorProps {
  listId: string;
  listTitle: string;
  onClose: (saved: boolean) => void;
}

export const ListCommandsEditor: React.FC<IListCommandsEditorProps> = ({ listId, listTitle, onClose }) => {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [config, setConfig] = React.useState<IListCommandsConfig>(ListCommandService.emptyConfig(listId));
  const [ref, setRef] = React.useState<IConfigRef>({});
  const [schema, setSchema] = React.useState<IFieldSchema[]>([]);
  const [groups, setGroups] = React.useState<GroupService.ISiteGroup[]>([]);
  const [lists, setLists] = React.useState<RelatedListService.IListInfo[]>([]);
  const [warning, setWarning] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState<boolean>(false);
  const [open, setOpen] = React.useState<string | undefined>();

  React.useEffect(() => {
    let active: boolean = true;
    Promise.all([
      ListCommandService.load(listId),
      getListSchema(listId),
      GroupService.getSiteGroups().catch(() => []),
      RelatedListService.getLists()
    ])
      .then(([loaded, fields, siteGroups, siteLists]) => {
        if (!active) {
          return;
        }
        setConfig(loaded.config ?? ListCommandService.emptyConfig(listId));
        setRef({ itemId: loaded.itemId, etag: loaded.etag });
        setWarning(loaded.warning);
        setSchema(fields);
        setGroups(siteGroups);
        setLists(siteLists);
        setOpen(loaded.config?.commands[0]?.id);
      })
      .catch(() => active && setError(strings.SetupLoadFailed))
      .then(() => active && setLoading(false))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [listId]);

  // A feltételekben a lista mezői, az azonosító, a létrehozó és a csoporttagság választható (igen / nem változóként).
  const conditionFields: IFieldSchema[] = React.useMemo(() => {
    const variable = (name: string, title: string): IFieldSchema => ({ InternalName: name, Title: title, TypeAsString: 'Boolean', Required: false, ReadOnlyField: true });
    return [{ InternalName: ID_FIELD, Title: ID_FIELD, TypeAsString: 'Counter', Required: false, ReadOnlyField: true } as IFieldSchema].concat(
      schema,
      [variable(AUTHOR_VARIABLE, strings.ConditionVarIsAuthor)],
      groups.map((group) => variable(groupVariable(group.id), format(strings.ConditionVarGroup, group.title)))
    );
  }, [schema, groups]);

  const commands: IListCommand[] = config.commands;
  const setCommands = (next: IListCommand[]): void => setConfig({ ...config, commands: next });
  const updateCommand = (index: number, patch: Partial<IListCommand>): void => {
    const next: IListCommand = { ...commands[index], ...patch };
    (Object.keys(next) as Array<keyof IListCommand>).forEach((key) => {
      if (next[key] === undefined || next[key] === '') {
        if (key !== 'title' && key !== 'id') {
          delete next[key];
        }
      }
    });
    setCommands(replaceAt(commands, index, next));
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(undefined);
    try {
      const nextRef: IConfigRef = await ListCommandService.save({ ...config, listId }, ref, listTitle);
      setRef(nextRef);
      // Menüpont nélkül a helyi menü lekerül a listáról.
      await ListCommandService.setEnabled(listId, commands.length > 0);
      onClose(true);
    } catch (e) {
      setError(format(strings.CommandSaveFailed, e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner size={SpinnerSize.large} label={strings.Loading} />;
  }

  const typeOptions: IDropdownOption[] = [
    { key: 'setValue', text: strings.CommandActionSetValue },
    { key: 'updateItems', text: strings.CommandActionUpdateItems },
    { key: 'createItem', text: strings.CommandActionCreateItem }
  ];

  return (
    <div className={classes.root}>
      <div className={classes.hint}>{format(strings.CommandEditorHint, LIST_COMMAND_SLOTS)}</div>
      {warning && <MessageBar messageBarType={MessageBarType.warning}>{warning}</MessageBar>}
      {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
      {commands.length === 0 && <div className={classes.hint}>{strings.CommandEmpty}</div>}
      {commands.map((command, index) => (
        <AccordionCard
          key={command.id}
          title={command.title || strings.CommandUntitled}
          open={open === command.id}
          onToggle={() => setOpen(open === command.id ? undefined : command.id)}
          actions={
            <>
              <IconButton iconProps={{ iconName: 'Up' }} title={strings.CommandMoveUp} disabled={index === 0} onClick={() => setCommands(move(commands, index, index - 1))} />
              <IconButton
                iconProps={{ iconName: 'Down' }}
                title={strings.CommandMoveDown}
                disabled={index === commands.length - 1}
                onClick={() => setCommands(move(commands, index, index + 1))}
              />
              <IconButton iconProps={{ iconName: 'Delete' }} title={strings.CommandDelete} onClick={() => setCommands(commands.filter((_, i) => i !== index))} />
            </>
          }
        >
          <TextField label={strings.CommandTitle} value={command.title} onChange={(_, v) => updateCommand(index, { title: v ?? '' })} />
          <div>
            <Label>{strings.CommandIcon}</Label>
            <div className={classes.iconRow}>
              {command.icon ? <Icon iconName={command.icon} className={classes.iconPreview} /> : <span className={classes.hint}>{strings.CommandIconNone}</span>}
              <IconPicker
                buttonLabel={strings.CommandIconSelect}
                currentIcon={command.icon}
                renderOption="dialog"
                onSave={(icon) => updateCommand(index, { icon: isIconName(icon) ? icon : undefined })}
              />
              {command.icon && (
                <IconButton iconProps={{ iconName: 'Cancel' }} title={strings.CommandIconRemove} onClick={() => updateCommand(index, { icon: undefined })} />
              )}
            </div>
          </div>
          <ConditionEditor
            key={`${command.id}:visible`}
            schema={conditionFields}
            label={strings.VisibleWhen}
            value={command.visibleWhen}
            onChange={(visibleWhen) => updateCommand(index, { visibleWhen })}
          />
          <TextField
            label={strings.CommandConfirm}
            placeholder={format(strings.CommandConfirmDefault, command.title)}
            multiline
            autoAdjustHeight
            rows={2}
            value={command.confirm ?? ''}
            onChange={(_, v) => updateCommand(index, { confirm: v || undefined })}
          />
          <TextField
            label={strings.CommandSuccess}
            placeholder={strings.CommandSuccessDefault}
            value={command.successMessage ?? ''}
            onChange={(_, v) => updateCommand(index, { successMessage: v || undefined })}
          />
          <Label>{strings.CommandSteps}</Label>
          {command.actions.map((action, actionIndex) => (
            <div key={actionIndex} className={classes.step}>
              <div className={classes.stepHeader}>
                <span className={classes.stepTitle}>{format(strings.ButtonActionStep, actionIndex + 1)}</span>
                <IconButton
                  iconProps={{ iconName: 'Up' }}
                  title={strings.ButtonActionMoveUp}
                  disabled={actionIndex === 0}
                  onClick={() => updateCommand(index, { actions: move(command.actions, actionIndex, actionIndex - 1) })}
                />
                <IconButton
                  iconProps={{ iconName: 'Down' }}
                  title={strings.ButtonActionMoveDown}
                  disabled={actionIndex === command.actions.length - 1}
                  onClick={() => updateCommand(index, { actions: move(command.actions, actionIndex, actionIndex + 1) })}
                />
                <IconButton
                  iconProps={{ iconName: 'Delete' }}
                  title={strings.ButtonActionRemove}
                  onClick={() => updateCommand(index, { actions: command.actions.filter((_, i) => i !== actionIndex) })}
                />
              </div>
              <Dropdown
                label={strings.ButtonActionType}
                options={typeOptions}
                selectedKey={action.type}
                onChange={(_, option) =>
                  option && option.key !== action.type && updateCommand(index, { actions: replaceAt(command.actions, actionIndex, newAction(option.key as ListCommandActionType)) })
                }
              />
              <ActionEditor
                action={action}
                schema={schema}
                lists={lists}
                onChange={(next) => updateCommand(index, { actions: replaceAt(command.actions, actionIndex, next) })}
              />
            </div>
          ))}
          <ActionButton
            className={classes.add}
            iconProps={{ iconName: 'Add' }}
            text={strings.ButtonActionAdd}
            onClick={() => updateCommand(index, { actions: [...command.actions, newAction('setValue')] })}
          />
        </AccordionCard>
      ))}
      <DefaultButton
        iconProps={{ iconName: 'Add' }}
        text={strings.CommandAdd}
        disabled={commands.length >= LIST_COMMAND_SLOTS}
        onClick={() => {
          const id: string = newCommandId(commands);
          setCommands([...commands, { id, title: '', actions: [] }]);
          setOpen(id);
        }}
      />
      <div className={classes.actions}>
        <PrimaryButton text={strings.SetupCommandsSave} disabled={saving} onClick={() => save().catch(() => undefined)} />
        <DefaultButton text={strings.Cancel} disabled={saving} onClick={() => onClose(false)} />
      </div>
    </div>
  );
};
