// A tervező Változók füle: a form változóinak felvétele, átnevezése, törlése és beállítása.
// Feltétel fajta: igen / nem a meglévő feltételszerkesztővel; érték fajta: forrásmező (élő vagy mentett) + átalakítások.
// Csak a draft konfigurációt módosítja az onChange-en keresztül, immutábilisan.

import * as React from 'react';
import { ActionButton, DefaultButton, IconButton } from '@fluentui/react/lib/Button';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { isVariableName, newVariableName, renameVariable, variableOrder, variableRef } from '../engine/FormVariables';
import { IFieldSchema } from '../models/IFieldSchema';
import {
  FormVariableKind,
  IFormConfig,
  IFormVariable,
  VARIABLE_TRANSFORMS,
  VariableTransform,
  VariableTransformType
} from '../models/IFormConfig';
import { AccordionCard } from './AccordionCard';
import { ConditionEditor } from './ConditionEditor';

/** Az új változó nevének alapja; a név azonosító, ezért nem fordítjuk. */
const NEW_VARIABLE_BASE: string = 'Variable';

const classes = mergeStyleSets({
  tab: { paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { fontSize: 12, color: '#605e5c' },
  transform: { display: 'flex', alignItems: 'flex-end', gap: 4 },
  transformType: { flex: 1, minWidth: 0 },
  transformNumber: { width: 72 },
  add: { height: 28, padding: 0 }
});

function transformLabels(): Record<VariableTransformType, string> {
  return {
    substring: strings.VariableTransformSubstring,
    number: strings.VariableTransformNumber,
    trim: strings.VariableTransformTrim,
    lower: strings.VariableTransformLower,
    upper: strings.VariableTransformUpper
  };
}

function newTransform(type: VariableTransformType): VariableTransform {
  return type === 'substring' ? { type, start: 0 } : { type };
}

/** Nemnegatív egész a szövegmezőből; üresre `undefined`. */
function toIndex(text: string | undefined): number | undefined {
  const value: number = Number((text ?? '').trim());
  return (text ?? '').trim() === '' || isNaN(value) || value < 0 ? undefined : Math.floor(value);
}

interface IVariableNameFieldProps {
  name: string;
  taken: (name: string) => boolean;
  onRename: (name: string) => void;
}

/** A változó neve: gépelés közben érvénytelen is lehet; csak érvényes, szabad névre nevez át (elhagyáskor). */
const VariableNameField: React.FC<IVariableNameFieldProps> = (props) => {
  const [text, setText] = React.useState<string>(props.name);
  React.useEffect(() => setText(props.name), [props.name]);
  const trimmed: string = text.trim();
  const error: string | undefined = !isVariableName(trimmed)
    ? strings.VariableNameInvalid
    : trimmed !== props.name && props.taken(trimmed)
      ? strings.VariableNameTaken
      : undefined;
  const commit = (): void => {
    if (!error && trimmed !== props.name) {
      props.onRename(trimmed);
    } else if (error) {
      setText(props.name);
    }
  };
  return (
    <TextField
      label={strings.VariableName}
      description={format(strings.VariableNameHint, variableRef(props.name))}
      value={text}
      errorMessage={error}
      onChange={(_, v) => setText(v ?? '')}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && commit()}
    />
  );
};

export interface IVariablesPanelProps {
  draft: IFormConfig;
  /** A mezők (felirat, gomb nélkül): a változó forrásmezője ezek közül választható. */
  fields: IFieldSchema[];
  /** A feltételekben választható mezők és változók. */
  conditionFields: IFieldSchema[];
  onChange: (draft: IFormConfig) => void;
}

export const VariablesPanel: React.FC<IVariablesPanelProps> = (props) => {
  const { draft } = props;
  const variables: Record<string, IFormVariable> = draft.variables ?? {};
  const names: string[] = Object.keys(variables);
  const [open, setOpen] = React.useState<string | undefined>(names[0]);
  const cyclic: string[] = variableOrder(variables).cyclic;
  const labels: Record<VariableTransformType, string> = transformLabels();

  const setVariables = (next: Record<string, IFormVariable>): void => {
    const config: IFormConfig = { ...draft, variables: next };
    if (Object.keys(next).length === 0) {
      delete config.variables;
    }
    props.onChange(config);
  };

  const update = (name: string, variable: IFormVariable): void => {
    // Az üres részek kimaradnak a konfigurációból.
    const clean: IFormVariable = { ...variable };
    (Object.keys(clean) as Array<keyof IFormVariable>).forEach((key) => {
      const value: unknown = clean[key];
      if (value === undefined || value === '' || value === false || (Array.isArray(value) && value.length === 0)) {
        delete clean[key];
      }
    });
    setVariables({ ...variables, [name]: clean });
  };

  const add = (): void => {
    const name: string = newVariableName(draft, NEW_VARIABLE_BASE);
    setVariables({ ...variables, [name]: { kind: 'condition' } });
    setOpen(name);
  };

  const remove = (name: string): void => {
    const next: Record<string, IFormVariable> = { ...variables };
    delete next[name];
    setVariables(next);
  };

  const fieldOptions = (current: string | undefined): IDropdownOption[] => {
    const options: IDropdownOption[] = props.fields.map((field) => ({ key: field.InternalName, text: `${field.Title} (${field.InternalName})` }));
    if (current && !props.fields.some((field) => field.InternalName === current)) {
      options.push({ key: current, text: current });
    }
    return options;
  };

  const renderTransforms = (name: string, variable: IFormVariable): JSX.Element => {
    const transforms: VariableTransform[] = variable.transforms ?? [];
    const setTransforms = (next: VariableTransform[]): void => update(name, { ...variable, transforms: next });
    return (
      <div>
        <Label>{strings.VariableTransforms}</Label>
        {transforms.length === 0 && <div className={classes.hint}>{strings.VariableTransformsEmpty}</div>}
        {transforms.map((transform, index) => (
          <div key={index} className={classes.transform}>
            <Dropdown
              className={classes.transformType}
              ariaLabel={strings.VariableTransforms}
              options={VARIABLE_TRANSFORMS.map((type) => ({ key: type, text: labels[type] }))}
              selectedKey={transform.type}
              onChange={(_, option) =>
                option && setTransforms(transforms.map((item, i) => (i === index ? newTransform(option.key as VariableTransformType) : item)))
              }
            />
            {transform.type === 'substring' && (
              <>
                <TextField
                  className={classes.transformNumber}
                  label={strings.VariableSubstringStart}
                  value={String(transform.start)}
                  onChange={(_, v) =>
                    setTransforms(transforms.map((item, i) => (i === index ? { ...transform, start: toIndex(v) ?? 0 } : item)))
                  }
                />
                <TextField
                  className={classes.transformNumber}
                  label={strings.VariableSubstringLength}
                  value={transform.length === undefined ? '' : String(transform.length)}
                  onChange={(_, v) => {
                    const next: VariableTransform = { type: 'substring', start: transform.start };
                    const length: number | undefined = toIndex(v);
                    if (length !== undefined) {
                      next.length = length;
                    }
                    setTransforms(transforms.map((item, i) => (i === index ? next : item)));
                  }}
                />
              </>
            )}
            <IconButton
              iconProps={{ iconName: 'Delete' }}
              title={strings.VariableTransformRemove}
              ariaLabel={strings.VariableTransformRemove}
              onClick={() => setTransforms(transforms.filter((_, i) => i !== index))}
            />
          </div>
        ))}
        <ActionButton
          className={classes.add}
          iconProps={{ iconName: 'Add' }}
          text={strings.VariableTransformAdd}
          onClick={() => setTransforms([...transforms, newTransform('substring')])}
        />
      </div>
    );
  };

  return (
    <div className={classes.tab}>
      <div className={classes.hint}>{strings.VariablesHint}</div>
      {names.length === 0 && <div className={classes.hint}>{strings.VariablesEmpty}</div>}
      {names.map((name) => {
        const variable: IFormVariable = variables[name];
        return (
          <AccordionCard
            key={name}
            title={name}
            open={open === name}
            onToggle={() => setOpen(open === name ? undefined : name)}
            actions={
              <IconButton iconProps={{ iconName: 'Delete' }} title={strings.VariableDelete} onClick={() => remove(name)} />
            }
          >
            <VariableNameField
              name={name}
              taken={(candidate) => variables[candidate] !== undefined}
              onRename={(next) => {
                props.onChange(renameVariable(draft, name, next));
                setOpen(next);
              }}
            />
            {cyclic.indexOf(name) !== -1 && <MessageBar messageBarType={MessageBarType.warning}>{strings.VariableCyclic}</MessageBar>}
            <Dropdown
              label={strings.VariableKind}
              options={[
                { key: 'condition', text: strings.VariableKindCondition },
                { key: 'value', text: strings.VariableKindValue }
              ]}
              selectedKey={variable.kind}
              // Fajtaváltáskor a másik fajta beállításai elvesznek.
              onChange={(_, option) => option && option.key !== variable.kind && update(name, { kind: option.key as FormVariableKind })}
            />
            {variable.kind === 'condition' ? (
              <ConditionEditor
                key={`${name}:when`}
                // A változó önmagára nem hivatkozhat.
                schema={props.conditionFields.filter((field) => field.InternalName !== variableRef(name))}
                label={strings.VariableWhen}
                value={variable.when}
                onChange={(when) => update(name, { ...variable, when })}
              />
            ) : (
              <>
                <Dropdown
                  label={strings.VariableSourceField}
                  placeholder={strings.ConditionFieldPlaceholder}
                  options={fieldOptions(variable.field)}
                  selectedKey={variable.field ?? null}
                  onChange={(_, option) => option && update(name, { ...variable, field: String(option.key) })}
                />
                <Checkbox
                  label={strings.VariableSaved}
                  checked={!!variable.saved}
                  onChange={(_, checked) => update(name, { ...variable, saved: !!checked })}
                />
                <div className={classes.hint}>{strings.VariableSavedHint}</div>
                {renderTransforms(name, variable)}
              </>
            )}
          </AccordionCard>
        );
      })}
      <DefaultButton iconProps={{ iconName: 'Add' }} text={strings.VariableAdd} onClick={add} />
    </div>
  );
};
