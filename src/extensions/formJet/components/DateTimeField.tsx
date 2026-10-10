// DateTime mező: Fluent DatePicker, dátum + idő megjelenítésnél TimePicker-rel.
// Az érték form-string, a web területi beállításai szerinti formátumban (engine/DateFormat.ts).

import * as React from 'react';
import { DatePicker, defaultDatePickerStrings, IDatePickerStrings } from '@fluentui/react/lib/DatePicker';
import { Label } from '@fluentui/react/lib/Label';
import { TextField } from '@fluentui/react/lib/TextField';
import { TimePicker } from '@fluentui/react/lib/TimePicker';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import {
  formatDateValue,
  getCalendarNames,
  getFirstDayOfWeek,
  parseDateValue
} from '../engine/DateFormat';
import { IResolvedField } from '../engine/LayoutResolver';
import { FormContext } from './FormContext';

const TIME_INCREMENT_MINUTES: number = 15;

const classes = mergeStyleSets({
  // A címke a sor fölött van, a két beviteli mező felülre igazodik: így a dátum vagy az idő alatti
  // hibaüzenet nem tolja el őket egymáshoz képest.
  row: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  date: { flex: 1, minWidth: 0 },
  // A DatePicker alatt 5px hely van; az időválasztó ugyanennyit kap.
  time: { width: 110, paddingBottom: 5 }
});

export interface IDateTimeFieldProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export const DateTimeField: React.FC<IDateTimeFieldProps> = (props) => {
  const { field, value, error } = props;
  const { cultureName, uiCultureName } = React.useContext(FormContext);
  const dateOnly: boolean = field.schema.DateOnly !== false;

  const parsed: Date | undefined = React.useMemo(() => parseDateValue(value, cultureName), [value, cultureName]);

  const pickerStrings: IDatePickerStrings = React.useMemo(
    () => ({
      ...defaultDatePickerStrings,
      ...getCalendarNames(uiCultureName),
      goToToday: strings.GoToToday,
      invalidInputErrorMessage: strings.InvalidDate,
      isRequiredErrorMessage: strings.RequiredField
    }),
    [uiCultureName]
  );

  // Ha a meglévő értéket nem tudjuk dátumként értelmezni, szövegként szerkeszthető marad, hogy ne vesszen el.
  if (value.trim() !== '' && !parsed) {
    return (
      <TextField
        label={field.label}
        required={field.required}
        value={value}
        placeholder={field.placeholder}
        description={strings.DateHint}
        errorMessage={error}
        onChange={(_, next) => props.onChange(next ?? '')}
      />
    );
  }

  const setDate = (date: Date | null | undefined): void => {
    if (!date) {
      props.onChange('');
      return;
    }
    // A DatePicker csak a napot adja; az időt a meglévő értékből tartjuk meg.
    const next: Date = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      parsed ? parsed.getHours() : 0,
      parsed ? parsed.getMinutes() : 0
    );
    props.onChange(formatDateValue(next, cultureName, dateOnly));
  };

  const setTime = (time: Date): void => {
    if (!parsed || isNaN(time.getTime())) {
      return;
    }
    const next: Date = new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      time.getHours(),
      time.getMinutes()
    );
    props.onChange(formatDateValue(next, cultureName, false));
  };

  const datePicker: JSX.Element = (
    <DatePicker
      className={dateOnly ? undefined : classes.date}
      label={dateOnly ? field.label : undefined}
      ariaLabel={dateOnly ? undefined : field.label}
      isRequired={field.required}
      value={parsed}
      allowTextInput
      placeholder={field.placeholder}
      strings={pickerStrings}
      firstDayOfWeek={getFirstDayOfWeek(cultureName)}
      formatDate={(date) => (date ? formatDateValue(date, cultureName, true) : '')}
      parseDateFromString={(text) => parseDateValue(text, cultureName) ?? null}
      onSelectDate={setDate}
      textField={{ errorMessage: error }}
    />
  );

  if (dateOnly) {
    return datePicker;
  }
  return (
    <div>
      <Label required={field.required}>{field.label}</Label>
      <div className={classes.row}>
        {datePicker}
        <div className={classes.time}>
          <TimePicker
            ariaLabel={`${field.label} – ${strings.Time}`}
            useHour12={false}
            allowFreeform
            increments={TIME_INCREMENT_MINUTES}
            disabled={!parsed}
            value={parsed}
            dateAnchor={parsed}
            strings={{ invalidInputErrorMessage: strings.InvalidTime }}
            onChange={(_, time) => setTime(time)}
          />
        </div>
      </div>
    </div>
  );
};
