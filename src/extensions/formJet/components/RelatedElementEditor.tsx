// A kapcsolódó elemek tulajdonságlapja a tervezőben, négy füllel: Lista (lista, párosítás, oszlopok, láthatóság),
// Hozzárendelés (személy mező, megnyithatóság), Felugró ablak (cím, leírás, megjegyzés, további mezők) és Gombok
// (szabályok, gombok, beállított értékek). Csak a kapott beállítást módosítja az onChange-en keresztül, immutábilisan.

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
import { IRelatedListConfig, IRelatedTaskConfig, ITaskButton, ITaskButtonRule, ITaskFieldConfig } from '../models/IFormConfig';
import { IFieldAssignment } from '../models/IListCommands';
import * as RelatedListService from '../services/RelatedListService';
import { ActionValueEditor } from './ButtonActionsEditor';
import { ConditionEditor } from './ConditionEditor';
import { RelatedListEditor } from './RelatedListEditor';

type RelatedTab = 'list' | 'assignment' | 'popup' | 'buttons';

const USER_TYPES: string[] = ['User', 'UserMulti'];

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
  if (task.fields && task.fields.length > 0) result.fields = task.fields;
  if (task.buttonRules && task.buttonRules.length > 0) result.buttonRules = task.buttonRules;
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

export interface IRelatedElementEditorProps {
  value: IRelatedListConfig;
  /** Ennek a listának a mezői (a párosítás forrásához). */
  schema: IFieldSchema[];
  /** A feltételekben választható mezők és környezeti változók (a gombszabályokhoz). */
  conditionFields: IFieldSchema[];
  /** Az elem SharePoint szerint írható mezői (a gombok az elem mezőit is beállíthatják). */
  itemFields: IFieldSchema[];
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
        </>
      )}
    </div>
  );

  const renderPopup = (): JSX.Element => {
    if (!task) {
      return <div className={classes.tab}>{needsTask}</div>;
    }
    const extra: ITaskFieldConfig[] = task.fields ?? [];
    const setExtra = (fields: ITaskFieldConfig[]): void => updateTask({ fields });
    const addable: IFieldSchema[] = taskFields.filter((field) => !extra.some((item) => item.field === field.InternalName));
    const titleOf = (name: string): string => taskFields.filter((field) => field.InternalName === name)[0]?.Title ?? name;
    return (
      <div className={classes.tab}>
        <Dropdown
          label={strings.TaskTitleField}
          dropdownWidth="auto"
          options={fieldOptions(taskFields, task.titleField ?? 'Title')}
          selectedKey={task.titleField ?? 'Title'}
          onChange={(_, option) => option && updateTask({ titleField: option.key === 'Title' ? undefined : String(option.key) })}
        />
        <Dropdown
          label={strings.TaskDescriptionField}
          dropdownWidth="auto"
          options={[{ key: '', text: strings.TaskNone }, ...fieldOptions(taskFields, task.descriptionField)]}
          selectedKey={task.descriptionField ?? ''}
          onChange={(_, option) => option && updateTask({ descriptionField: String(option.key) || undefined })}
        />
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
        <div>
          <Label>{strings.TaskFields}</Label>
          {extra.length === 0 && <div className={classes.hint}>{strings.TaskFieldsEmpty}</div>}
          {extra.map((item, index) => (
            <div key={item.field} className={classes.row}>
              <span className={classes.rowName}>{titleOf(item.field)}</span>
              <Checkbox
                label={strings.TaskFieldEditable}
                checked={!!item.editable}
                disabled={!settableTaskFields.some((field) => field.InternalName === item.field)}
                onChange={(_, checked) => setExtra(replaceAt(extra, index, checked ? { field: item.field, editable: true } : { field: item.field }))}
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
