// Mezőtípus → vezérlő. Új mezőtípus bekötése: docs/FEJLESZTOI_LEIRAS.md, 8. fejezet.

import * as React from 'react';
import { ComboBox, IComboBoxOption } from '@fluentui/react/lib/ComboBox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { TextField } from '@fluentui/react/lib/TextField';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { joinMultiValue, splitMultiValue } from '../engine/ConditionEngine';
import { IResolvedField } from '../engine/LayoutResolver';
import { IFieldSchema } from '../models/IFieldSchema';
import { DateTimeField } from './DateTimeField';

// A TipTap szerkesztő nagy; csak akkor töltjük le, ha a formon van rich text mező.
const RichTextField = React.lazy(() => import(/* webpackChunkName: 'formjet-richtext' */ './RichTextField'));

const TEXT_YES: string = strings.Yes;
const TEXT_NO: string = strings.No;
const TEXT_EMPTY: string = '–';

const classes = mergeStyleSets({
  readOnlyValue: { padding: '6px 0', minHeight: 20, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  description: { fontSize: 12, color: '#605e5c', marginTop: 4 },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

export interface IFieldRendererProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  /** Megjelenítésre szánt szöveg (FieldValuesAsText), ha az érték nem változott a betöltés óta. */
  displayValue?: string;
  error?: string;
  onChange: (name: string, value: string) => void;
}

function formatReadOnly(schema: IFieldSchema, value: string): string {
  if (value === '') {
    return TEXT_EMPTY;
  }
  switch (schema.TypeAsString) {
    case 'Boolean':
      return value === '1' ? TEXT_YES : TEXT_NO;
    case 'MultiChoice':
      return splitMultiValue(value).join(', ') || TEXT_EMPTY;
    default:
      return value;
  }
}

function choiceOptions(schema: IFieldSchema, selected: string[], withEmpty: boolean): IDropdownOption[] {
  const choices: string[] = (schema.Choices ?? []).slice();
  // A listából időközben törölt vagy kézzel beírt érték is maradjon kiválasztható.
  selected.forEach((item) => {
    if (item !== '' && choices.indexOf(item) === -1) {
      choices.push(item);
    }
  });
  const options: IDropdownOption[] = choices.map((choice) => ({ key: choice, text: choice }));
  return withEmpty ? [{ key: '', text: '' }, ...options] : options;
}

export const FieldRenderer: React.FC<IFieldRendererProps> = (props) => {
  const { field, value, displayValue, error } = props;
  const { schema, label, required, description, placeholder } = field;
  const set = (next: string): void => props.onChange(field.name, next);

  const footer: JSX.Element = (
    <>
      {description && <div className={classes.description}>{description}</div>}
      {error && (
        <div className={classes.error} role="alert">
          {error}
        </div>
      )}
    </>
  );

  // Rich text Note: szerkesztve és csak olvashatóként is a TipTap jeleníti meg a HTML-t.
  if (schema.TypeAsString === 'Note' && schema.RichText && (!field.readOnly || value !== '')) {
    return (
      <React.Suspense fallback={<Spinner size={SpinnerSize.small} label={strings.Loading} labelPosition="right" />}>
        <RichTextField
          label={label}
          value={value}
          required={required}
          readOnly={field.readOnly}
          description={description}
          error={error}
          lines={schema.NumberOfLines}
          onChange={set}
        />
      </React.Suspense>
    );
  }

  if (field.readOnly) {
    return (
      <div>
        <Label>{label}</Label>
        <div className={classes.readOnlyValue}>{displayValue || formatReadOnly(schema, value)}</div>
        {footer}
      </div>
    );
  }

  switch (schema.TypeAsString) {
    case 'Note':
      return (
        <TextField
          label={label}
          required={required}
          multiline
          rows={schema.NumberOfLines || 6}
          value={value}
          placeholder={placeholder}
          description={description}
          errorMessage={error}
          onChange={(_, next) => set(next ?? '')}
        />
      );

    case 'Choice':
      if (schema.FillInChoice) {
        return (
          <div>
            <ComboBox
              label={label}
              required={required}
              allowFreeform
              autoComplete="on"
              text={value}
              selectedKey={value || null}
              placeholder={placeholder}
              options={choiceOptions(schema, [value], false) as IComboBoxOption[]}
              onChange={(_, option, __, text) => set(option ? String(option.key) : text ?? '')}
            />
            {footer}
          </div>
        );
      }
      return (
        <div>
          <Dropdown
            label={label}
            required={required}
            selectedKey={value}
            placeholder={placeholder}
            options={choiceOptions(schema, [value], !required)}
            onChange={(_, option) => set(option ? String(option.key) : '')}
          />
          {footer}
        </div>
      );

    case 'MultiChoice': {
      const selected: string[] = splitMultiValue(value);
      return (
        <div>
          <Dropdown
            label={label}
            required={required}
            multiSelect
            selectedKeys={selected}
            placeholder={placeholder}
            options={choiceOptions(schema, selected, false)}
            onChange={(_, option) => {
              if (!option) {
                return;
              }
              const key: string = String(option.key);
              set(joinMultiValue(option.selected ? [...selected, key] : selected.filter((item) => item !== key)));
            }}
          />
          {footer}
        </div>
      );
    }

    case 'Boolean':
      return (
        <div>
          <Toggle
            label={label}
            checked={value === '1'}
            onText={TEXT_YES}
            offText={TEXT_NO}
            onChange={(_, checked) => set(checked ? '1' : '0')}
          />
          {footer}
        </div>
      );

    case 'DateTime':
      return (
        <div>
          <DateTimeField field={field} value={value} error={error} onChange={set} />
          {description && <div className={classes.description}>{description}</div>}
        </div>
      );

    // Text, Number, Currency
    default:
      return (
        <TextField
          label={label}
          required={required}
          value={value}
          maxLength={schema.TypeAsString === 'Text' ? schema.MaxLength : undefined}
          placeholder={placeholder}
          description={description}
          errorMessage={error}
          onChange={(_, next) => set(next ?? '')}
        />
      );
  }
};
