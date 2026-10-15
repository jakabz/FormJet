// Feltétel tömeges beállítása a tervezőben: egy feltétel (például egy változóra épülő) egyszerre több mezőre,
// felülírva, a meglévővel ÉS / VAGY kapcsolatban, vagy a meglévő törlésével. A logika: engine/BulkConditions.ts.

import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { applyConditionToFields, BulkConditionMode, BulkConditionProperty } from '../engine/BulkConditions';
import { format } from '../engine/EngineStrings';
import { isButtonElement, isTextElement } from '../engine/TextElement';
import { IFieldSchema } from '../models/IFieldSchema';
import { Condition, IFormConfig } from '../models/IFormConfig';
import { ConditionEditor } from './ConditionEditor';

const DIALOG_WIDTH: number = 640;

const classes = mergeStyleSets({
  body: { display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { fontSize: 12, color: '#605e5c' },
  list: { maxHeight: 280, overflowY: 'auto', border: '1px solid #c8c6c4', borderRadius: 2, padding: '4px 8px' },
  section: { padding: '6px 0', borderBottom: '1px solid #edebe9', selectors: { ':last-child': { borderBottom: 'none' } } },
  fields: { display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 0 24px' }
});

/** Érvényes-e a beállítás a mezőre: felirat nem lehet csak olvasható, és a mező nélküli elem nem lehet kötelező. */
function supports(field: IFieldSchema, property: BulkConditionProperty): boolean {
  if (property === 'requiredWhen') {
    return !isTextElement(field) && !isButtonElement(field);
  }
  if (property === 'readOnlyWhen') {
    return !isTextElement(field);
  }
  return true;
}

export interface IBulkConditionDialogProps {
  hidden: boolean;
  draft: IFormConfig;
  /** A séma a feliratokkal és a gombokkal együtt (a mezők címéhez és fajtájához). */
  schema: IFieldSchema[];
  /** A feltételekben választható mezők és változók. */
  conditionFields: IFieldSchema[];
  onChange: (draft: IFormConfig) => void;
  onDismiss: () => void;
}

export const BulkConditionDialog: React.FC<IBulkConditionDialogProps> = (props) => {
  const { draft } = props;
  const [property, setProperty] = React.useState<BulkConditionProperty>('visibleWhen');
  const [mode, setMode] = React.useState<BulkConditionMode>('replace');
  const [condition, setCondition] = React.useState<Condition | undefined>();
  const [selected, setSelected] = React.useState<string[]>([]);

  // Megnyitáskor tiszta állapot.
  React.useEffect(() => {
    if (!props.hidden) {
      setCondition(undefined);
      setSelected([]);
    }
  }, [props.hidden]);

  const schemaOf = (name: string): IFieldSchema | undefined => props.schema.filter((field) => field.InternalName === name)[0];
  const eligible = (name: string): boolean => {
    const field: IFieldSchema | undefined = schemaOf(name);
    return field !== undefined && supports(field, property);
  };
  const chosen: string[] = selected.filter(eligible);
  const toggle = (names: string[], checked: boolean): void =>
    setSelected(checked ? selected.concat(names.filter((name) => selected.indexOf(name) === -1)) : selected.filter((name) => names.indexOf(name) === -1));

  const apply = (): void => {
    props.onChange(applyConditionToFields(draft, chosen, property, mode === 'clear' ? undefined : condition, mode));
    props.onDismiss();
  };
  const ready: boolean = chosen.length > 0 && (mode === 'clear' || condition !== undefined);

  return (
    <Dialog
      hidden={props.hidden}
      minWidth={DIALOG_WIDTH}
      maxWidth={DIALOG_WIDTH}
      dialogContentProps={{ type: DialogType.normal, title: strings.BulkConditionTitle }}
      modalProps={{ isBlocking: true }}
      onDismiss={props.onDismiss}
    >
      <div className={classes.body}>
        <div className={classes.hint}>{strings.BulkConditionHint}</div>
        <Dropdown
          label={strings.BulkConditionProperty}
          options={[
            { key: 'visibleWhen', text: strings.VisibleWhen },
            { key: 'readOnlyWhen', text: strings.BulkConditionReadOnly },
            { key: 'requiredWhen', text: strings.RequiredWhen }
          ]}
          selectedKey={property}
          onChange={(_, option) => option && setProperty(option.key as BulkConditionProperty)}
        />
        <Dropdown
          label={strings.BulkConditionMode}
          options={[
            { key: 'replace', text: strings.BulkConditionReplace },
            { key: 'and', text: strings.BulkConditionAnd },
            { key: 'or', text: strings.BulkConditionOr },
            { key: 'clear', text: strings.BulkConditionClear }
          ]}
          selectedKey={mode}
          onChange={(_, option) => option && setMode(option.key as BulkConditionMode)}
        />
        {mode !== 'clear' && (
          <ConditionEditor schema={props.conditionFields} label={strings.BulkConditionCondition} value={condition} onChange={setCondition} />
        )}
        <div>
          <Label>{format(strings.BulkConditionFields, chosen.length)}</Label>
          <div className={classes.list}>
            {draft.sections.map((section) => {
              const names: string[] = section.fields.map((placement) => placement.field).filter(eligible);
              if (names.length === 0) {
                return undefined;
              }
              const all: boolean = names.every((name) => selected.indexOf(name) !== -1);
              return (
                <div key={section.id} className={classes.section}>
                  <Checkbox
                    label={section.title || section.id}
                    checked={all}
                    indeterminate={!all && names.some((name) => selected.indexOf(name) !== -1)}
                    onChange={(_, checked) => toggle(names, !!checked)}
                  />
                  <div className={classes.fields}>
                    {names.map((name) => (
                      <Checkbox
                        key={name}
                        label={`${schemaOf(name)?.Title ?? name} (${name})`}
                        checked={selected.indexOf(name) !== -1}
                        onChange={(_, checked) => toggle([name], !!checked)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <DialogFooter>
        <PrimaryButton text={format(strings.BulkConditionApply, chosen.length)} disabled={!ready} onClick={apply} />
        <DefaultButton text={strings.Cancel} onClick={props.onDismiss} />
      </DialogFooter>
    </Dialog>
  );
};
