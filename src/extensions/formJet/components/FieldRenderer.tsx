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

import { ATTACHMENTS_FIELD } from '../engine/Attachments';
import { joinMultiValue, splitMultiValue } from '../engine/ConditionEngine';
import { IResolvedField } from '../engine/LayoutResolver';
import { formatLocationValue } from '../engine/LocationValue';
import { getCurrencyAffix, ICurrencyAffix } from '../engine/NumberFormat';
import { formatUserValue } from '../engine/UserValue';
import { IFieldSchema } from '../models/IFieldSchema';
import { AttachmentsField } from './AttachmentsField';
import { DateTimeField } from './DateTimeField';
import { ImageField } from './ImageField';
import { LocationField } from './LocationField';
import { LookupField } from './LookupField';
import { PeopleField } from './PeopleField';
import { UrlField } from './UrlField';

// A TipTap szerkesztő nagy; csak akkor töltjük le, ha a formon van rich text mező.
const RichTextField = React.lazy(() => import(/* webpackChunkName: 'formjet-richtext' */ './RichTextField'));

const TEXT_YES: string = strings.Yes;
const TEXT_NO: string = strings.No;
const TEXT_EMPTY: string = '–';
const PERCENT_SIGN: string = '%';

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
    case 'User':
    case 'UserMulti':
      return formatUserValue(value) || TEXT_EMPTY;
    case 'Location':
      return formatLocationValue(value) || TEXT_EMPTY;
    default: {
      if (schema.Percentage) {
        return `${value}${PERCENT_SIGN}`;
      }
      const currency: ICurrencyAffix | undefined = getCurrencyAffix(schema.CurrencyLocaleId);
      if (currency) {
        return currency.position === 'prefix' ? `${currency.symbol}${value}` : `${value} ${currency.symbol}`;
      }
      return value;
    }
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

  // Keresőmező: ha nincs kész megjelenítendő szöveg (az érték a betöltés óta változott), a választó oldja fel a neveket.
  const isLookup: boolean = schema.LookupListId !== undefined;
  if (field.readOnly && isLookup && !displayValue && value !== '') {
    return (
      <div>
        <LookupField field={field} value={value} onChange={set} />
        {footer}
      </div>
    );
  }

  // Mellékletek: nem form-string érték; szerkesztve és csak olvashatóként is a saját vezérlője jeleníti meg.
  if (schema.TypeAsString === ATTACHMENTS_FIELD) {
    return (
      <div>
        <AttachmentsField field={field} error={error} />
        {description && <div className={classes.description}>{description}</div>}
      </div>
    );
  }

  // Kép: szerkesztve és csak olvashatóként is a saját vezérlője jeleníti meg.
  if (schema.TypeAsString === 'Thumbnail') {
    return (
      <div>
        <ImageField field={field} value={value} error={error} onChange={set} />
        {description && <div className={classes.description}>{description}</div>}
      </div>
    );
  }

  // Hely: csak olvashatóként is a saját vezérlője jeleníti meg (térkép ikonnal).
  if (field.readOnly && schema.TypeAsString === 'Location' && value !== '') {
    return (
      <div>
        <LocationField field={field} value={value} onChange={set} />
        {footer}
      </div>
    );
  }

  // Hivatkozás: csak olvashatóként is a saját vezérlője jeleníti meg (hivatkozásként vagy képként).
  if (field.readOnly && schema.TypeAsString === 'URL' && value !== '') {
    return (
      <div>
        <UrlField field={field} value={value} onChange={set} />
        {footer}
      </div>
    );
  }

  if (field.readOnly) {
    return (
      <div>
        <Label>{label}</Label>
        <div className={classes.readOnlyValue}>
          {(schema.TypeAsString === 'Location' ? undefined : displayValue) || formatReadOnly(schema, value)}
        </div>
        {footer}
      </div>
    );
  }

  const currency: ICurrencyAffix | undefined = getCurrencyAffix(schema.CurrencyLocaleId);

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

    case 'User':
    case 'UserMulti':
      return (
        <div>
          <PeopleField field={field} value={value} error={error} onChange={set} />
          {description && <div className={classes.description}>{description}</div>}
        </div>
      );

    case 'Lookup':
    case 'LookupMulti':
      return (
        <div>
          <LookupField field={field} value={value} error={error} onChange={set} />
          {description && <div className={classes.description}>{description}</div>}
        </div>
      );

    case 'Location':
      return (
        <div>
          <LocationField field={field} value={value} error={error} onChange={set} />
          {description && <div className={classes.description}>{description}</div>}
        </div>
      );

    case 'URL':
      return (
        <div>
          <UrlField field={field} value={value} error={error} onChange={set} />
          {description && <div className={classes.description}>{description}</div>}
        </div>
      );

    // Text, Number, Currency
    default: {
      const prefix: string | undefined = currency?.position === 'prefix' ? currency.symbol : undefined;
      const suffix: string | undefined = schema.Percentage
        ? PERCENT_SIGN
        : currency?.position === 'suffix'
          ? currency.symbol
          : undefined;
      return (
        <TextField
          label={label}
          required={required}
          value={value}
          maxLength={schema.TypeAsString === 'Text' ? schema.MaxLength : undefined}
          prefix={prefix}
          suffix={suffix}
          // Utótagnál (%, Ft) a szám jobbra igazodik, hogy a jel mellett álljon; előtagnál ($) balra marad.
          styles={suffix ? { field: { textAlign: 'right' } } : undefined}
          placeholder={placeholder}
          description={description}
          errorMessage={error}
          onChange={(_, next) => set(next ?? '')}
        />
      );
    }
  }
};
