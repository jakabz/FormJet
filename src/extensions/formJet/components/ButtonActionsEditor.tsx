// A gomb műveleteinek szerkesztése a tervezőben: gomb + felugró ablak, amelyben a lépések (mező értékének beállítása,
// mentés, bezárás) sorban összeállíthatók. Csak a kapott lépéslistát módosítja az onChange-en keresztül, immutábilisan.

import * as React from 'react';
import { ActionButton, DefaultButton, IconButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { ComboBox, IComboBoxOption } from '@fluentui/react/lib/ComboBox';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { effectiveActions } from '../engine/ButtonAction';
import { joinMultiValue, splitMultiValue } from '../engine/ConditionEngine';
import { format } from '../engine/EngineStrings';
import { IFieldSchema } from '../models/IFieldSchema';
import { ButtonAction, ButtonActionType } from '../models/IFormConfig';

const DIALOG_WIDTH: number = 600;

const classes = mergeStyleSets({
  hint: { fontSize: 12, color: '#605e5c', marginBottom: 12 },
  empty: { fontSize: 12, color: '#605e5c', fontStyle: 'italic' },
  steps: { display: 'flex', flexDirection: 'column', gap: 12 },
  step: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid #c8c6c4', borderRadius: 2 },
  stepUnreachable: { opacity: 0.6 },
  stepHeader: { display: 'flex', alignItems: 'center', gap: 4 },
  stepTitle: { flex: 1, fontWeight: 600 },
  add: { height: 28, padding: 0, marginTop: 8 }
});

function move<T>(items: T[], from: number, to: number): T[] {
  const next: T[] = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** A választóban külön elem a „mentés, nyitva marad”, a konfigurációban ez `save` + `keepOpen`. */
type ActionChoice = ButtonActionType | 'saveStay';

function choiceOf(action: ButtonAction): ActionChoice {
  return action.type === 'save' && action.keepOpen ? 'saveStay' : action.type;
}

/** Új lépés a választott művelettel; a mező értékének beállításánál a korábbi mező és érték megmarad. */
function withType(action: ButtonAction, choice: ActionChoice): ButtonAction {
  if (choice === 'setValue') {
    return action.type === 'setValue' ? action : { type: 'setValue', field: '', value: '' };
  }
  if (choice === 'saveStay') {
    return { type: 'save', keepOpen: true };
  }
  return { type: choice };
}

/** A választható értékek: a mező értékkészlete, kiegészítve a már beállított, de onnan hiányzó értékekkel. */
function choiceOptions(field: IFieldSchema, selected: string[]): IDropdownOption[] {
  const choices: string[] = (field.Choices ?? []).slice();
  selected.forEach((item) => {
    if (item !== '' && choices.indexOf(item) === -1) {
      choices.push(item);
    }
  });
  return choices.map((choice) => ({ key: choice, text: choice }));
}

interface IActionValueEditorProps {
  /** A kiválasztott mező; hiányában (még nincs kiválasztva) sima szövegmező. */
  field?: IFieldSchema;
  /** Az érték a kezdőérték formátumában (form-string). */
  value: string;
  onChange: (value: string) => void;
}

/**
 * A beállítandó érték vezérlője a mező típusához igazodik, mint a feltételszerkesztőben: választásnál a mező értékei
 * közül (több választásnál többet is), igen/nem mezőnél Igen / Nem; egyébként szövegmező a kezdőérték formátumában.
 */
const ActionValueEditor: React.FC<IActionValueEditorProps> = ({ field, value, onChange }) => {
  const type: string | undefined = field?.TypeAsString;
  if (field && type === 'Boolean') {
    return (
      <Dropdown
        label={strings.ButtonActionValue}
        options={[
          { key: '1', text: strings.Yes },
          { key: '0', text: strings.No }
        ]}
        selectedKey={value === '1' || value === '0' ? value : null}
        onChange={(_, option) => option && onChange(String(option.key))}
      />
    );
  }
  if (field && type === 'MultiChoice') {
    const selected: string[] = splitMultiValue(value);
    return (
      <Dropdown
        label={strings.ButtonActionValue}
        placeholder={strings.ButtonActionValueEmpty}
        multiSelect
        options={choiceOptions(field, selected)}
        selectedKeys={selected}
        onChange={(_, option) => {
          if (option) {
            const key: string = String(option.key);
            onChange(joinMultiValue(option.selected ? [...selected, key] : selected.filter((item) => item !== key)));
          }
        }}
      />
    );
  }
  if (field && type === 'Choice') {
    // Saját érték is beírható, ha az oszlop engedi; az üres választás törli a mező értékét.
    const options: IDropdownOption[] = [{ key: '', text: strings.ButtonActionValueEmpty }, ...choiceOptions(field, [value])];
    return field.FillInChoice ? (
      <ComboBox
        label={strings.ButtonActionValue}
        allowFreeform
        autoComplete="on"
        text={value}
        selectedKey={value || null}
        options={options as IComboBoxOption[]}
        onChange={(_, option, __, text) => onChange(option ? String(option.key) : text ?? '')}
      />
    ) : (
      <Dropdown
        label={strings.ButtonActionValue}
        options={options}
        selectedKey={value}
        onChange={(_, option) => option && onChange(String(option.key))}
      />
    );
  }
  return (
    <TextField
      label={strings.ButtonActionValue}
      description={strings.ButtonActionSetValueHint}
      value={value}
      onChange={(_, v) => onChange(v ?? '')}
    />
  );
};

export interface IButtonActionsEditorProps {
  /** A gomb felirata; a felugró ablak címében szerepel. */
  buttonTitle: string;
  actions: ButtonAction[];
  /** A mezők, amelyek értéke beállítható. */
  fields: IFieldSchema[];
  onChange: (actions: ButtonAction[]) => void;
}

export const ButtonActionsEditor: React.FC<IButtonActionsEditorProps> = (props) => {
  const { actions } = props;
  const [open, setOpen] = React.useState<boolean>(false);
  const reachable: number = effectiveActions(actions).length;

  const typeOptions: IDropdownOption[] = [
    { key: 'setValue', text: strings.ButtonActionSetValue },
    { key: 'save', text: strings.ButtonActionSave },
    { key: 'saveStay', text: strings.ButtonActionSaveStay },
    { key: 'close', text: strings.ButtonActionClose }
  ];
  const fieldOptions = (current: string): IDropdownOption[] => {
    const options: IDropdownOption[] = props.fields.map((field) => ({
      key: field.InternalName,
      text: `${field.Title} (${field.InternalName})`
    }));
    // A már nem létező (vagy nem szerkeszthető) mező is maradjon látható, hogy a szerkesztő észrevegye.
    if (current !== '' && !props.fields.some((field) => field.InternalName === current)) {
      options.push({ key: current, text: current });
    }
    return options;
  };

  const update = (index: number, action: ButtonAction): void => {
    props.onChange(actions.map((item, i) => (i === index ? action : item)));
  };

  return (
    <div>
      <Label>{strings.ButtonActions}</Label>
      <DefaultButton
        iconProps={{ iconName: 'Flow' }}
        text={actions.length > 0 ? format(strings.ButtonActionsEditCount, actions.length) : strings.ButtonActionsEdit}
        onClick={() => setOpen(true)}
      />
      <Dialog
        hidden={!open}
        minWidth={DIALOG_WIDTH}
        maxWidth={DIALOG_WIDTH}
        dialogContentProps={{ type: DialogType.normal, title: format(strings.ButtonActionsTitle, props.buttonTitle) }}
        modalProps={{ isBlocking: false }}
        onDismiss={() => setOpen(false)}
      >
        <div className={classes.hint}>{strings.ButtonActionsHint}</div>
        <div className={classes.steps}>
          {actions.length === 0 && <div className={classes.empty}>{strings.ButtonActionsEmpty}</div>}
          {actions.map((action, index) => (
            <div key={index} className={`${classes.step} ${index >= reachable ? classes.stepUnreachable : ''}`}>
              <div className={classes.stepHeader}>
                <span className={classes.stepTitle}>{format(strings.ButtonActionStep, index + 1)}</span>
                <IconButton
                  iconProps={{ iconName: 'Up' }}
                  title={strings.ButtonActionMoveUp}
                  ariaLabel={strings.ButtonActionMoveUp}
                  disabled={index === 0}
                  onClick={() => props.onChange(move(actions, index, index - 1))}
                />
                <IconButton
                  iconProps={{ iconName: 'Down' }}
                  title={strings.ButtonActionMoveDown}
                  ariaLabel={strings.ButtonActionMoveDown}
                  disabled={index === actions.length - 1}
                  onClick={() => props.onChange(move(actions, index, index + 1))}
                />
                <IconButton
                  iconProps={{ iconName: 'Delete' }}
                  title={strings.ButtonActionRemove}
                  ariaLabel={strings.ButtonActionRemove}
                  onClick={() => props.onChange(actions.filter((_, i) => i !== index))}
                />
              </div>
              {index >= reachable && (
                <MessageBar messageBarType={MessageBarType.warning}>{strings.ButtonActionUnreachable}</MessageBar>
              )}
              <Dropdown
                label={strings.ButtonActionType}
                options={typeOptions}
                selectedKey={choiceOf(action)}
                onChange={(_, option) => option && update(index, withType(action, option.key as ActionChoice))}
              />
              {action.type === 'setValue' && (
                <>
                  <Dropdown
                    label={strings.ButtonActionField}
                    placeholder={strings.ConditionFieldPlaceholder}
                    options={fieldOptions(action.field)}
                    selectedKey={action.field === '' ? null : action.field}
                    // Másik mezőnél a korábbi érték már nem biztos, hogy értelmes (például választásnál), ezért törlődik.
                    onChange={(_, option) =>
                      option && update(index, { ...action, field: String(option.key), value: option.key === action.field ? action.value : '' })
                    }
                  />
                  <ActionValueEditor
                    field={props.fields.filter((item) => item.InternalName === action.field)[0]}
                    value={action.value}
                    onChange={(value) => update(index, { ...action, value })}
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <ActionButton
          className={classes.add}
          iconProps={{ iconName: 'Add' }}
          text={strings.ButtonActionAdd}
          onClick={() => props.onChange([...actions, { type: 'setValue', field: '', value: '' }])}
        />
        <DialogFooter>
          <PrimaryButton text={strings.Close} onClick={() => setOpen(false)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
};
