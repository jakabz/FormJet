// Feltételes érték szerkesztése a tervezőben: egy szöveges beállítás (címke, leírás, helykitöltő, kezdőérték) melletti
// gomb, amely felugró ablakban a szabályokat mutatja. Egy szabály: egy feltétel és a hozzá tartozó érték.
// Csak a kapott szabálylistát módosítja az onChange-en keresztül, immutábilisan.

import * as React from 'react';
import { ActionButton, IconButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { IFieldSchema } from '../models/IFieldSchema';
import { IConditionalValue } from '../models/IFormConfig';
import { ConditionEditor } from './ConditionEditor';

const DIALOG_WIDTH: number = 560;
const ACTIVE_COLOR: string = '#0078d4';

const classes = mergeStyleSets({
  // A szövegmező és a gombja egy sorban; a gomb a mező aljához igazodik (a címke fölötte van).
  fieldRow: { display: 'flex', alignItems: 'flex-end', gap: 4 },
  fieldGrow: { flex: 1, minWidth: 0 },
  button: { position: 'relative', flexShrink: 0 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    boxSizing: 'border-box',
    borderRadius: 8,
    background: ACTIVE_COLOR,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 600,
    lineHeight: '16px',
    textAlign: 'center',
    pointerEvents: 'none'
  },
  hint: { fontSize: 12, color: '#605e5c', marginBottom: 12 },
  rules: { display: 'flex', flexDirection: 'column', gap: 12 },
  rule: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid #c8c6c4', borderRadius: 2 },
  ruleHeader: { display: 'flex', alignItems: 'center', gap: 4 },
  ruleTitle: { flex: 1, fontWeight: 600 },
  add: { height: 28, padding: 0, marginTop: 8 }
});

function move<T>(items: T[], from: number, to: number): T[] {
  const next: T[] = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export interface IConditionalValueFieldProps {
  /** A beállítás neve, például „Címke”. */
  label: string;
  /** A mező címe; a felugró ablak címében szerepel. */
  fieldTitle: string;
  rules: IConditionalValue[];
  /** A mezők és változók, amelyekre feltétel épülhet. */
  schema: IFieldSchema[];
  /** További tudnivaló a felugró ablakban (például a kezdőérték formátuma). */
  hint?: string;
  onChange: (rules: IConditionalValue[]) => void;
  /** A beállítás alapértékének szövegmezője. */
  children: React.ReactNode;
}

/** Egy szöveges beállítás a feltételes értékek gombjával. */
export const ConditionalValueField: React.FC<IConditionalValueFieldProps> = (props) => {
  const { rules } = props;
  const [open, setOpen] = React.useState<boolean>(false);
  const active: number = rules.filter((rule) => rule.when !== undefined).length;
  const title: string = active > 0 ? format(strings.ConditionalValueButtonActive, props.label, active) : format(strings.ConditionalValueButton, props.label);

  const update = (index: number, patch: Partial<IConditionalValue>): void => {
    props.onChange(
      rules.map((rule, i) => {
        if (i !== index) {
          return rule;
        }
        const next: IConditionalValue = { ...rule, ...patch };
        if (next.when === undefined) {
          delete next.when;
        }
        return next;
      })
    );
  };

  return (
    <div className={classes.fieldRow}>
      <div className={classes.fieldGrow}>{props.children}</div>
      <div className={classes.button}>
        <IconButton
          iconProps={{ iconName: 'BranchFork2' }}
          title={title}
          ariaLabel={title}
          styles={active > 0 ? { root: { color: ACTIVE_COLOR }, icon: { fontWeight: 600 } } : { root: { color: '#605e5c' } }}
          onClick={() => setOpen(true)}
        />
        {active > 0 && <span className={classes.badge}>{active}</span>}
      </div>
      <Dialog
        hidden={!open}
        minWidth={DIALOG_WIDTH}
        maxWidth={DIALOG_WIDTH}
        dialogContentProps={{ type: DialogType.normal, title: format(strings.ConditionalValueTitle, props.label, props.fieldTitle) }}
        modalProps={{ isBlocking: false }}
        onDismiss={() => setOpen(false)}
      >
        <div className={classes.hint}>
          {strings.ConditionalValueHint}
          {props.hint ? ` ${props.hint}` : ''}
        </div>
        <div className={classes.rules}>
          {rules.map((rule, index) => (
            <div key={index} className={classes.rule}>
              <div className={classes.ruleHeader}>
                <span className={classes.ruleTitle}>{format(strings.ConditionalValueRule, index + 1)}</span>
                <IconButton
                  iconProps={{ iconName: 'Up' }}
                  title={strings.ConditionalValueMoveUp}
                  ariaLabel={strings.ConditionalValueMoveUp}
                  disabled={index === 0}
                  onClick={() => props.onChange(move(rules, index, index - 1))}
                />
                <IconButton
                  iconProps={{ iconName: 'Down' }}
                  title={strings.ConditionalValueMoveDown}
                  ariaLabel={strings.ConditionalValueMoveDown}
                  disabled={index === rules.length - 1}
                  onClick={() => props.onChange(move(rules, index, index + 1))}
                />
                <IconButton
                  iconProps={{ iconName: 'Delete' }}
                  title={strings.ConditionalValueRemove}
                  ariaLabel={strings.ConditionalValueRemove}
                  onClick={() => props.onChange(rules.filter((_, i) => i !== index))}
                />
              </div>
              <ConditionEditor
                schema={props.schema}
                label={strings.ConditionalValueWhen}
                value={rule.when}
                onChange={(when) => update(index, { when })}
              />
              <TextField
                label={format(strings.ConditionalValueValue, props.label)}
                value={rule.value}
                onChange={(_, v) => update(index, { value: v ?? '' })}
              />
            </div>
          ))}
        </div>
        <ActionButton
          className={classes.add}
          iconProps={{ iconName: 'Add' }}
          text={strings.ConditionalValueAdd}
          onClick={() => props.onChange([...rules, { value: '' }])}
        />
        <DialogFooter>
          <PrimaryButton text={strings.Close} onClick={() => setOpen(false)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
};
