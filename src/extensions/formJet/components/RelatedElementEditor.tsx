// A kapcsolódó elemek tulajdonságlapja a tervezőben, négy füllel: Lista (lista, párosítás, oszlopok, láthatóság),
// Hozzárendelés (személy mező, megnyithatóság, delegálás), Felugró ablak (cím, leírás, megjegyzés, további mezők) és Gombok
// (szabályok, gombok, beállított értékek). JSON alapú feladatnál a felugró ablak tartalmát a kérés oszlop adja, ezért a
// Felugró ablak fülön csak a cím, a Gombok fülön csak a Beküldés gomb beállított értékei maradnak.
// Csak a kapott beállítást módosítja az onChange-en keresztül, immutábilisan.

import * as React from 'react';
import { ActionButton, IconButton } from '@fluentui/react/lib/Button';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { isButtonSettableField } from '../engine/ButtonAction';
import { format } from '../engine/EngineStrings';
import { taskVariable } from '../engine/RelatedList';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  IRelatedListConfig,
  IRelatedTaskConfig,
  ITaskButton,
  ITaskButtonRule,
  ITaskDelegationConfig,
  ITaskFieldConfig,
  ITaskJsonConfig
} from '../models/IFormConfig';
import { IFieldAssignment } from '../models/IListCommands';
import { ISiteGroup } from '../services/GroupService';
import * as RelatedListService from '../services/RelatedListService';
import { ActionValueEditor } from './ButtonActionsEditor';
import { ConditionEditor } from './ConditionEditor';
import { RelatedListEditor } from './RelatedListEditor';

type RelatedTab = 'list' | 'assignment' | 'popup' | 'buttons';

const USER_TYPES: string[] = ['User', 'UserMulti'];
/** A JSON oszlopok szokásos belső neve: bekapcsoláskor ezek választódnak ki, ha léteznek. */
const DEFAULT_REQUEST_FIELD: string = 'RequestJSON';
const DEFAULT_RESPONSE_FIELD: string = 'ResponseJSON';
/** A delegálás mezőinek szokásos belső neve: bekapcsoláskor ezek választódnak ki, ha léteznek. */
const DEFAULT_DELEGATED_TO_FIELD: string = 'DelegatedTo';
const DEFAULT_STATUS_FIELD: string = 'Status';

const classes = mergeStyleSets({
  tab: { paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { fontSize: 12, color: '#605e5c' },
  row: { display: 'flex', alignItems: 'center', gap: 4 },
  rowEnd: { display: 'flex', alignItems: 'flex-end', gap: 4 },
  rowName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  grow: { flex: 1, minWidth: 0 },
  card: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid #c8c6c4', borderRadius: 2 },
  innerCard: { display: 'flex', flexDirection: 'column', gap: 8, padding: 8, border: '1px solid #edebe9', borderRadius: 2, background: '#faf9f8' },
  cardTitle: { flex: 1, fontWeight: 600 },
  add: { height: 28, padding: 0, alignSelf: 'flex-start' }
});

function fieldOption(field: IFieldSchema): IDropdownOption {
  return { key: field.InternalName, text: field.Title === field.InternalName ? field.Title : `${field.Title} (${field.InternalName})` };
}

/** Választható mezők; a beállított, de onnan hiányzó (törölt) mező is megjelenik, hogy látsszon a beállítás. */
function fieldOptions(fields: IFieldSchema[], selected: string | undefined): IDropdownOption[] {
  const options: IDropdownOption[] = fields.map(fieldOption);
  if (selected && !fields.some((field) => field.InternalName === selected)) {
    options.push({ key: selected, text: selected });
  }
  return options;
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

/** Az üres tömbök és értékek elhagyása, hogy a mentett JSON tiszta maradjon. */
function compactTask(task: IRelatedTaskConfig): IRelatedTaskConfig {
  const result: IRelatedTaskConfig = { assignedField: task.assignedField };
  if (task.openWhen) result.openWhen = task.openWhen;
  if (task.allowView) result.allowView = true;
  if (task.titleField) result.titleField = task.titleField;
  if (task.descriptionField) result.descriptionField = task.descriptionField;
  if (task.commentField) result.commentField = task.commentField;
  if (task.statusField) result.statusField = task.statusField;
  if (task.fields && task.fields.length > 0) result.fields = task.fields;
  if (task.buttonRules && task.buttonRules.length > 0) result.buttonRules = task.buttonRules;
  if (task.json) {
    const json: ITaskJsonConfig = { requestField: task.json.requestField, responseField: task.json.responseField };
    if (task.json.taskValues && task.json.taskValues.length > 0) json.taskValues = task.json.taskValues;
    if (task.json.itemValues && task.json.itemValues.length > 0) json.itemValues = task.json.itemValues;
    result.json = json;
  }
  if (task.delegation) {
    const delegation: ITaskDelegationConfig = {
      delegatedToField: task.delegation.delegatedToField,
      statusField: task.delegation.statusField,
      statusValue: task.delegation.statusValue
    };
    if (task.delegation.groupId !== undefined) delegation.groupId = task.delegation.groupId;
    if (task.delegation.statuses && task.delegation.statuses.length > 0) delegation.statuses = task.delegation.statuses;
    if (task.delegation.commentField) delegation.commentField = task.delegation.commentField;
    result.delegation = delegation;
  }
  return result;
}

interface IAssignmentsProps {
  label: string;
  values: IFieldAssignment[];
  fields: IFieldSchema[];
  hint: string;
  onChange: (values: IFieldAssignment[] | undefined) => void;
}

/** Mezőértékek listája: mező + a típusához igazodó érték. */
const Assignments: React.FC<IAssignmentsProps> = ({ label, values, fields, hint, onChange }) => {
  const emit = (next: IFieldAssignment[]): void => onChange(next.length > 0 ? next : undefined);
  return (
    <div>
      <Label>{label}</Label>
      {values.map((assignment, index) => (
        <div key={index} className={classes.innerCard}>
          <div className={classes.rowEnd}>
            <Dropdown
              className={classes.grow}
              label={strings.CommandTargetField}
              placeholder={strings.CommandValueFieldPlaceholder}
              dropdownWidth="auto"
              options={fieldOptions(fields, assignment.field)}
              selectedKey={assignment.field || null}
              onChange={(_, option) => option && emit(replaceAt(values, index, { field: String(option.key), value: '' }))}
            />
            <IconButton
              iconProps={{ iconName: 'Delete' }}
              title={strings.CommandAssignmentRemove}
              ariaLabel={strings.CommandAssignmentRemove}
              onClick={() => emit(values.filter((_, i) => i !== index))}
            />
          </div>
          <ActionValueEditor
            field={fields.filter((field) => field.InternalName === assignment.field)[0]}
            value={assignment.value}
            description={hint}
            onChange={(value) => emit(replaceAt(values, index, { ...assignment, value }))}
          />
        </div>
      ))}
      <ActionButton
        className={classes.add}
        iconProps={{ iconName: 'Add' }}
        text={strings.CommandAssignmentAdd}
        onClick={() => emit([...values, { field: '', value: '' }])}
      />
    </div>
  );
};

function isChoiceField(field: IFieldSchema | undefined): boolean {
  return !!field && (field.TypeAsString === 'Choice' || field.TypeAsString === 'MultiChoice');
}

interface IStatusValuesPickerProps {
  label?: string;
  ariaLabel?: string;
  placeholder: string;
  /** Az állapot mező belső neve (a szövegmező ennek változásakor újraindul). */
  statusFieldName: string;
  statusField: IFieldSchema | undefined;
  values: string[];
  /** Üres kiválasztásnál `undefined`. */
  onChange: (values: string[] | undefined) => void;
}

/**
 * Állapotértékek kiválasztása: választás mezőnél a mező értékei közül (többet is), egyébként pontosvesszővel elválasztva
 * beírva. A beállított, de a mezőből azóta törölt érték is látszik, hogy kivehető legyen.
 */
const StatusValuesPicker: React.FC<IStatusValuesPickerProps> = (props) => {
  const { values, statusField } = props;
  const emit = (next: string[]): void => props.onChange(next.length > 0 ? next : undefined);
  if (isChoiceField(statusField)) {
    const choices: string[] = statusField?.Choices ?? [];
    return (
      <Dropdown
        label={props.label}
        ariaLabel={props.ariaLabel ?? props.label}
        placeholder={props.placeholder}
        multiSelect
        dropdownWidth="auto"
        options={choices.concat(values.filter((item) => choices.indexOf(item) === -1)).map((item) => ({ key: item, text: item }))}
        selectedKeys={values}
        onChange={(_, option) => {
          if (option) {
            const key: string = String(option.key);
            emit(option.selected ? [...values, key] : values.filter((item) => item !== key));
          }
        }}
      />
    );
  }
  return (
    <TextField
      key={props.statusFieldName}
      label={props.label}
      ariaLabel={props.ariaLabel ?? props.label}
      placeholder={props.placeholder}
      defaultValue={values.join('; ')}
      onBlur={(e) =>
        emit(
          e.currentTarget.value
            .split(';')
            .map((item) => item.trim())
            .filter((item, i, all) => item !== '' && all.indexOf(item) === i)
        )
      }
    />
  );
};

export interface IRelatedElementEditorProps {
  value: IRelatedListConfig;
  /** Ennek a listának a mezői (a párosítás forrásához). */
  schema: IFieldSchema[];
  /** A feltételekben választható mezők és környezeti változók (a gombszabályokhoz). */
  conditionFields: IFieldSchema[];
  /** Az elem SharePoint szerint írható mezői (a gombok az elem mezőit is beállíthatják). */
  itemFields: IFieldSchema[];
  /** A webhely SharePoint csoportjai (a delegálás csoportjához). */
  siteGroups: ISiteGroup[];
  /** A Lista fül alján: a láthatóság és a letiltás beállításai. */
  general: React.ReactNode;
  onChange: (value: IRelatedListConfig) => void;
}

export const RelatedElementEditor: React.FC<IRelatedElementEditorProps> = (props) => {
  const { value } = props;
  const task: IRelatedTaskConfig | undefined = value.task;
  const [tab, setTab] = React.useState<RelatedTab>('list');
  const [taskSchema, setTaskSchema] = React.useState<IFieldSchema[]>([]);
  const [schemaError, setSchemaError] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (value.listId === '') {
      setTaskSchema([]);
      return;
    }
    let cancelled: boolean = false;
    RelatedListService.getListSchema(value.listId)
      .then((fields) => {
        if (!cancelled) {
          setTaskSchema(fields);
          setSchemaError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTaskSchema([]);
          setSchemaError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value.listId]);

  const setTask = (next: IRelatedTaskConfig | undefined): void => {
    const config: IRelatedListConfig = { ...value };
    if (next) {
      config.task = compactTask(next);
    } else {
      delete config.task;
    }
    props.onChange(config);
  };
  const updateTask = (patch: Partial<IRelatedTaskConfig>): void => {
    if (task) {
      setTask({ ...task, ...patch });
    }
  };

  const taskFields: IFieldSchema[] = taskSchema.filter((field) => field.TypeAsString !== 'Attachments');
  const settableTaskFields: IFieldSchema[] = taskFields.filter(isButtonSettableField);
  const noteFields: IFieldSchema[] = taskFields.filter((field) => field.TypeAsString === 'Note');
  const defaultField = (fields: IFieldSchema[], name: string): string =>
    fields.filter((field) => field.InternalName.toLowerCase() === name.toLowerCase())[0]?.InternalName ?? '';
  const updateDelegation = (patch: Partial<ITaskDelegationConfig>): void => {
    if (task?.delegation) {
      updateTask({ delegation: { ...task.delegation, ...patch } });
    }
  };
  const updateJson = (patch: Partial<ITaskJsonConfig>): void => {
    if (task?.json) {
      updateTask({ json: { ...task.json, ...patch } });
    }
  };
  // A gombszabályok feltételei az elem mezőit, a környezeti változókat és a feladat mezőit (előtaggal) látják.
  const ruleFields: IFieldSchema[] = React.useMemo(
    () =>
      props.conditionFields.concat(
        taskFields.map((field) => ({
          ...field,
          InternalName: taskVariable(field.InternalName),
          Title: format(strings.TaskVarField, field.Title)
        }))
      ),
    [props.conditionFields, taskSchema]
  );

  const needsTask: JSX.Element = <div className={classes.hint}>{strings.TaskNeedsEnable}</div>;

  // Mely állapotokban jelenjen meg a Delegálom gomb. Üresen minden állapotban.
  const renderDelegationStatuses = (delegation: ITaskDelegationConfig, statusField: IFieldSchema | undefined): JSX.Element => (
    <>
      <StatusValuesPicker
        label={strings.TaskDelegationStatuses}
        placeholder={strings.TaskDelegationStatusesAll}
        statusFieldName={delegation.statusField}
        statusField={statusField}
        values={delegation.statuses ?? []}
        onChange={(statuses) => updateDelegation({ statuses })}
      />
      <div className={classes.hint}>
        {isChoiceField(statusField) ? strings.TaskDelegationStatusesHint : strings.TaskDelegationStatusesTextHint}
      </div>
    </>
  );

  // Delegálás: a csoport tagjai a feladatot másnak adhatják át (állapot + delegált személy + indoklás).
  const renderDelegation = (current: IRelatedTaskConfig): JSX.Element => {
    const delegation: ITaskDelegationConfig | undefined = current.delegation;
    const groupOptions: IDropdownOption[] = props.siteGroups.map((group) => ({ key: group.id, text: group.title }));
    if (delegation?.groupId !== undefined && !props.siteGroups.some((group) => group.id === delegation.groupId)) {
      groupOptions.push({ key: delegation.groupId, text: `#${delegation.groupId}` });
    }
    const statusField: IFieldSchema | undefined = settableTaskFields.filter((field) => field.InternalName === delegation?.statusField)[0];
    return (
      <>
        <Checkbox
          label={strings.TaskDelegationEnable}
          checked={!!delegation}
          onChange={(_, checked) =>
            updateTask({
              delegation: checked
                ? {
                    delegatedToField: defaultField(
                      settableTaskFields.filter((field) => USER_TYPES.indexOf(field.TypeAsString) !== -1),
                      DEFAULT_DELEGATED_TO_FIELD
                    ),
                    statusField: defaultField(settableTaskFields, DEFAULT_STATUS_FIELD),
                    statusValue: strings.TaskDelegationStatusDefault
                  }
                : undefined
            })
          }
        />
        <div className={classes.hint}>{strings.TaskDelegationHint}</div>
        {delegation && (
          <div className={classes.card}>
            <Dropdown
              label={strings.TaskDelegationGroup}
              placeholder={strings.TaskDelegationGroupPlaceholder}
              dropdownWidth="auto"
              options={groupOptions}
              selectedKey={delegation.groupId ?? null}
              onChange={(_, option) => option && updateDelegation({ groupId: Number(option.key) })}
            />
            <Dropdown
              label={strings.TaskDelegationToField}
              placeholder={strings.CommandValueFieldPlaceholder}
              dropdownWidth="auto"
              options={fieldOptions(
                settableTaskFields.filter((field) => USER_TYPES.indexOf(field.TypeAsString) !== -1),
                delegation.delegatedToField
              )}
              selectedKey={delegation.delegatedToField || null}
              onChange={(_, option) => option && updateDelegation({ delegatedToField: String(option.key) })}
            />
            <Dropdown
              label={strings.TaskDelegationStatusField}
              placeholder={strings.CommandValueFieldPlaceholder}
              dropdownWidth="auto"
              options={fieldOptions(settableTaskFields, delegation.statusField)}
              selectedKey={delegation.statusField || null}
              // Más mezőnél a korábban választott állapotok nem érvényesek.
              onChange={(_, option) => option && updateDelegation({ statusField: String(option.key), statuses: undefined })}
            />
            {delegation.statusField !== '' && (
              <ActionValueEditor
                field={statusField}
                label={strings.TaskDelegationStatusValue}
                value={delegation.statusValue}
                onChange={(statusValue) => updateDelegation({ statusValue })}
              />
            )}
            {delegation.statusField !== '' && renderDelegationStatuses(delegation, statusField)}
            <Dropdown
              label={strings.TaskDelegationCommentField}
              placeholder={strings.CommandValueFieldPlaceholder}
              dropdownWidth="auto"
              options={fieldOptions(
                settableTaskFields.filter((field) => field.TypeAsString === 'Note'),
                delegation.commentField
              )}
              selectedKey={delegation.commentField || null}
              onChange={(_, option) => option && updateDelegation({ commentField: String(option.key) })}
            />
            {(delegation.groupId === undefined || delegation.delegatedToField === '') && (
              <div className={classes.hint}>{strings.TaskDelegationIncomplete}</div>
            )}
          </div>
        )}
      </>
    );
  };

  const renderAssignment = (): JSX.Element => (
    <div className={classes.tab}>
      {value.listId === '' && <div className={classes.hint}>{strings.TaskNeedsList}</div>}
      {schemaError && <MessageBar messageBarType={MessageBarType.warning}>{strings.RelatedLoadFailed}</MessageBar>}
      <Checkbox
        label={strings.TaskEnable}
        checked={task !== undefined}
        disabled={value.listId === ''}
        onChange={(_, checked) => setTask(checked ? { assignedField: '' } : undefined)}
      />
      {task && (
        <>
          <Dropdown
            label={strings.TaskAssignedField}
            placeholder={strings.CommandValueFieldPlaceholder}
            dropdownWidth="auto"
            options={fieldOptions(
              taskFields.filter((field) => USER_TYPES.indexOf(field.TypeAsString) !== -1),
              task.assignedField
            )}
            selectedKey={task.assignedField || null}
            onChange={(_, option) => option && updateTask({ assignedField: String(option.key) })}
          />
          <div className={classes.hint}>{strings.TaskAssignedHint}</div>
          <ConditionEditor
            key={`${value.listId}:openWhen`}
            label={strings.TaskOpenWhen}
            schema={taskFields}
            value={task.openWhen}
            onChange={(openWhen) => updateTask({ openWhen })}
          />
          <div className={classes.hint}>{strings.TaskOpenWhenHint}</div>
          <Checkbox
            label={strings.TaskAllowView}
            checked={!!task.allowView}
            onChange={(_, checked) => updateTask({ allowView: checked ? true : undefined })}
          />
          <div className={classes.hint}>{strings.TaskAllowViewHint}</div>
          {renderDelegation(task)}
          <Checkbox
            label={strings.TaskJsonEnable}
            checked={!!task.json}
            onChange={(_, checked) =>
              updateTask({
                json: checked
                  ? {
                      requestField: defaultField(noteFields, DEFAULT_REQUEST_FIELD),
                      responseField: defaultField(settableTaskFields.filter((field) => field.TypeAsString === 'Note'), DEFAULT_RESPONSE_FIELD)
                    }
                  : undefined
              })
            }
          />
          {task.json && (
            <>
              <Dropdown
                label={strings.TaskJsonRequestField}
                placeholder={strings.CommandValueFieldPlaceholder}
                dropdownWidth="auto"
                options={fieldOptions(noteFields, task.json.requestField)}
                selectedKey={task.json.requestField || null}
                onChange={(_, option) => option && updateJson({ requestField: String(option.key) })}
              />
              <Dropdown
                label={strings.TaskJsonResponseField}
                placeholder={strings.CommandValueFieldPlaceholder}
                dropdownWidth="auto"
                options={fieldOptions(
                  settableTaskFields.filter((field) => field.TypeAsString === 'Note'),
                  task.json.responseField
                )}
                selectedKey={task.json.responseField || null}
                onChange={(_, option) => option && updateJson({ responseField: String(option.key) })}
              />
              <div className={classes.hint}>{strings.TaskJsonHint}</div>
            </>
          )}
        </>
      )}
    </div>
  );

  const renderPopup = (): JSX.Element => {
    if (!task) {
      return <div className={classes.tab}>{needsTask}</div>;
    }
    const titleDropdown: JSX.Element = (
      <Dropdown
        label={strings.TaskTitleField}
        dropdownWidth="auto"
        options={fieldOptions(taskFields, task.titleField ?? 'Title')}
        selectedKey={task.titleField ?? 'Title'}
        onChange={(_, option) => option && updateTask({ titleField: option.key === 'Title' ? undefined : String(option.key) })}
      />
    );
    const descriptionDropdown: JSX.Element = (
      <Dropdown
        label={strings.TaskDescriptionField}
        dropdownWidth="auto"
        options={[{ key: '', text: strings.TaskNone }, ...fieldOptions(taskFields, task.descriptionField)]}
        selectedKey={task.descriptionField ?? ''}
        onChange={(_, option) => option && updateTask({ descriptionField: String(option.key) || undefined })}
      />
    );
    if (task.json) {
      return (
        <div className={classes.tab}>
          <MessageBar messageBarType={MessageBarType.info}>{strings.TaskJsonPopupInactive}</MessageBar>
          {titleDropdown}
          {descriptionDropdown}
        </div>
      );
    }
    const extra: ITaskFieldConfig[] = task.fields ?? [];
    const setExtra = (fields: ITaskFieldConfig[]): void => updateTask({ fields });
    const addable: IFieldSchema[] = taskFields.filter((field) => !extra.some((item) => item.field === field.InternalName));
    const titleOf = (name: string): string => taskFields.filter((field) => field.InternalName === name)[0]?.Title ?? name;
    const popupStatusField: IFieldSchema | undefined = taskFields.filter((field) => field.InternalName === task.statusField)[0];
    return (
      <div className={classes.tab}>
        {titleDropdown}
        {descriptionDropdown}
        <Dropdown
          label={strings.TaskCommentField}
          dropdownWidth="auto"
          options={[
            { key: '', text: strings.TaskNoComment },
            ...fieldOptions(
              settableTaskFields.filter((field) => field.TypeAsString === 'Note'),
              task.commentField
            )
          ]}
          selectedKey={task.commentField ?? ''}
          onChange={(_, option) => option && updateTask({ commentField: String(option.key) || undefined })}
        />
        <div className={classes.hint}>{strings.TaskCommentHint}</div>
        <Dropdown
          label={strings.TaskStatusField}
          dropdownWidth="auto"
          options={[{ key: '', text: strings.TaskNone }, ...fieldOptions(taskFields, task.statusField)]}
          selectedKey={task.statusField ?? ''}
          onChange={(_, option) => {
            if (option) {
              // Más állapot mezőnél a mezőkhöz választott állapotok nem érvényesek.
              updateTask({
                statusField: String(option.key) || undefined,
                fields: extra.map((item) => (item.editable ? { field: item.field, editable: true } : { field: item.field }))
              });
            }
          }}
        />
        <div className={classes.hint}>{strings.TaskStatusFieldHint}</div>
        <div>
          <Label>{strings.TaskFields}</Label>
          {extra.length === 0 && <div className={classes.hint}>{strings.TaskFieldsEmpty}</div>}
          {extra.map((item, index) => (
            <div key={item.field} className={task.statusField ? classes.innerCard : undefined}>
              <div className={classes.row}>
                <span className={classes.rowName}>{titleOf(item.field)}</span>
                <Checkbox
                  label={strings.TaskFieldEditable}
                  checked={!!item.editable}
                  disabled={!settableTaskFields.some((field) => field.InternalName === item.field)}
                  onChange={(_, checked) => {
                    const next: ITaskFieldConfig = { ...item };
                    if (checked) {
                      next.editable = true;
                    } else {
                      delete next.editable;
                    }
                    setExtra(replaceAt(extra, index, next));
                  }}
                />
                <IconButton
                  iconProps={{ iconName: 'Up' }}
                  title={strings.FieldMoveUp}
                  disabled={index === 0}
                  onClick={() => setExtra(move(extra, index, index - 1))}
                />
                <IconButton
                  iconProps={{ iconName: 'Down' }}
                  title={strings.FieldMoveDown}
                  disabled={index === extra.length - 1}
                  onClick={() => setExtra(move(extra, index, index + 1))}
                />
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  title={strings.FieldRemove}
                  onClick={() => setExtra(extra.filter((_, i) => i !== index))}
                />
              </div>
              {task.statusField && (
                <StatusValuesPicker
                  ariaLabel={format(strings.TaskFieldStatusesAria, titleOf(item.field))}
                  placeholder={strings.TaskFieldStatusesAll}
                  statusFieldName={task.statusField}
                  statusField={popupStatusField}
                  values={item.statuses ?? []}
                  onChange={(statuses) => {
                    const next: ITaskFieldConfig = { ...item };
                    if (statuses) {
                      next.statuses = statuses;
                    } else {
                      delete next.statuses;
                    }
                    setExtra(replaceAt(extra, index, next));
                  }}
                />
              )}
            </div>
          ))}
          {addable.length > 0 && (
            <Dropdown
              placeholder={strings.TaskFieldAdd}
              ariaLabel={strings.TaskFieldAdd}
              dropdownWidth="auto"
              options={addable.map(fieldOption)}
              selectedKey={null}
              onChange={(_, option) => option && setExtra([...extra, { field: String(option.key) }])}
            />
          )}
        </div>
      </div>
    );
  };

  const renderButtons = (): JSX.Element => {
    if (!task) {
      return <div className={classes.tab}>{needsTask}</div>;
    }
    if (task.json) {
      return (
        <div className={classes.tab}>
          <MessageBar messageBarType={MessageBarType.info}>{strings.TaskJsonButtonsHint}</MessageBar>
          <Assignments
            label={strings.TaskTaskValues}
            values={task.json.taskValues ?? []}
            fields={settableTaskFields}
            hint={strings.TaskValueHint}
            onChange={(taskValues) => updateJson({ taskValues })}
          />
          <Assignments
            label={strings.TaskItemValues}
            values={task.json.itemValues ?? []}
            fields={props.itemFields}
            hint={strings.TaskItemValueHint}
            onChange={(itemValues) => updateJson({ itemValues })}
          />
        </div>
      );
    }
    const rules: ITaskButtonRule[] = task.buttonRules ?? [];
    const setRules = (next: ITaskButtonRule[]): void => updateTask({ buttonRules: next });
    const setRule = (index: number, patch: Partial<ITaskButtonRule>): void => {
      const rule: ITaskButtonRule = { ...rules[index], ...patch };
      if (!rule.when) {
        delete rule.when;
      }
      setRules(replaceAt(rules, index, rule));
    };
    const setButton = (ruleIndex: number, buttonIndex: number, button: ITaskButton): void => {
      const clean: ITaskButton = { label: button.label };
      if (button.primary) clean.primary = true;
      if (button.commentRequired) clean.commentRequired = true;
      if (button.taskValues) clean.taskValues = button.taskValues;
      if (button.itemValues) clean.itemValues = button.itemValues;
      setRule(ruleIndex, { buttons: replaceAt(rules[ruleIndex].buttons, buttonIndex, clean) });
    };
    return (
      <div className={classes.tab}>
        <div className={classes.hint}>{strings.TaskRulesHint}</div>
        {rules.map((rule, ruleIndex) => (
          <div key={ruleIndex} className={classes.card}>
            <div className={classes.row}>
              <span className={classes.cardTitle}>{format(strings.TaskRule, ruleIndex + 1)}</span>
              <IconButton
                iconProps={{ iconName: 'Up' }}
                title={strings.TaskRuleMoveUp}
                disabled={ruleIndex === 0}
                onClick={() => setRules(move(rules, ruleIndex, ruleIndex - 1))}
              />
              <IconButton
                iconProps={{ iconName: 'Down' }}
                title={strings.TaskRuleMoveDown}
                disabled={ruleIndex === rules.length - 1}
                onClick={() => setRules(move(rules, ruleIndex, ruleIndex + 1))}
              />
              <IconButton
                iconProps={{ iconName: 'Delete' }}
                title={strings.TaskRuleDelete}
                onClick={() => setRules(rules.filter((_, i) => i !== ruleIndex))}
              />
            </div>
            <ConditionEditor
              key={`${value.listId}:rule:${ruleIndex}`}
              label={strings.TaskRuleWhen}
              schema={ruleFields}
              value={rule.when}
              onChange={(when) => setRule(ruleIndex, { when })}
            />
            {rule.buttons.length === 0 && <div className={classes.hint}>{strings.TaskRuleNoButtons}</div>}
            {rule.buttons.map((button, buttonIndex) => (
              <div key={buttonIndex} className={classes.innerCard}>
                <div className={classes.rowEnd}>
                  <TextField
                    className={classes.grow}
                    label={strings.TaskButtonLabel}
                    value={button.label}
                    onChange={(_, v) => setButton(ruleIndex, buttonIndex, { ...button, label: v ?? '' })}
                  />
                  <IconButton
                    iconProps={{ iconName: 'Back' }}
                    title={strings.FooterMoveLeft}
                    disabled={buttonIndex === 0}
                    onClick={() => setRule(ruleIndex, { buttons: move(rule.buttons, buttonIndex, buttonIndex - 1) })}
                  />
                  <IconButton
                    iconProps={{ iconName: 'Forward' }}
                    title={strings.FooterMoveRight}
                    disabled={buttonIndex === rule.buttons.length - 1}
                    onClick={() => setRule(ruleIndex, { buttons: move(rule.buttons, buttonIndex, buttonIndex + 1) })}
                  />
                  <IconButton
                    iconProps={{ iconName: 'Delete' }}
                    title={strings.TaskButtonDelete}
                    onClick={() => setRule(ruleIndex, { buttons: rule.buttons.filter((_, i) => i !== buttonIndex) })}
                  />
                </div>
                <Checkbox
                  label={strings.ButtonElementPrimary}
                  checked={!!button.primary}
                  onChange={(_, checked) => setButton(ruleIndex, buttonIndex, { ...button, primary: !!checked })}
                />
                <Checkbox
                  label={strings.TaskButtonCommentRequired}
                  checked={!!button.commentRequired}
                  disabled={!task.commentField}
                  onChange={(_, checked) => setButton(ruleIndex, buttonIndex, { ...button, commentRequired: !!checked })}
                />
                <Assignments
                  label={strings.TaskTaskValues}
                  values={button.taskValues ?? []}
                  fields={settableTaskFields}
                  hint={strings.TaskValueHint}
                  onChange={(taskValues) => setButton(ruleIndex, buttonIndex, { ...button, taskValues })}
                />
                <Assignments
                  label={strings.TaskItemValues}
                  values={button.itemValues ?? []}
                  fields={props.itemFields}
                  hint={strings.TaskItemValueHint}
                  onChange={(itemValues) => setButton(ruleIndex, buttonIndex, { ...button, itemValues })}
                />
              </div>
            ))}
            <ActionButton
              className={classes.add}
              iconProps={{ iconName: 'ButtonControl' }}
              text={strings.ButtonElementAdd}
              onClick={() => setRule(ruleIndex, { buttons: [...rule.buttons, { label: '' }] })}
            />
          </div>
        ))}
        <ActionButton
          className={classes.add}
          iconProps={{ iconName: 'Add' }}
          text={strings.TaskRuleAdd}
          onClick={() => setRules([...rules, { buttons: [] }])}
        />
      </div>
    );
  };

  return (
    <Pivot selectedKey={tab} onLinkClick={(item) => item?.props.itemKey && setTab(item.props.itemKey as RelatedTab)}>
      <PivotItem headerText={strings.RelatedTabList} itemKey="list">
        <div className={classes.tab}>
          <RelatedListEditor value={value} schema={props.schema} onChange={props.onChange} />
          {props.general}
        </div>
      </PivotItem>
      <PivotItem headerText={strings.RelatedTabAssignment} itemKey="assignment">
        {renderAssignment()}
      </PivotItem>
      <PivotItem headerText={strings.RelatedTabPopup} itemKey="popup">
        {renderPopup()}
      </PivotItem>
      <PivotItem headerText={strings.RelatedTabButtons} itemKey="buttons">
        {renderButtons()}
      </PivotItem>
    </Pivot>
  );
};
