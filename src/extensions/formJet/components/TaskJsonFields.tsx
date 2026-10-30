// A JSON alapú feladat mezői a felugró ablakban (engine/TaskJson.ts): igen / nem, szöveg, többsoros szöveg, szám,
// dátum és választás. Az értékek szövegként, a JSON-ban tárolt alakjukban mennek ki (dátum: ÉÉÉÉ-HH-NN, igen / nem: yes / no).

import * as React from 'react';
import { ChoiceGroup } from '@fluentui/react/lib/ChoiceGroup';
import { DatePicker, defaultDatePickerStrings, IDatePickerStrings } from '@fluentui/react/lib/DatePicker';
import { Dropdown } from '@fluentui/react/lib/Dropdown';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { formatDateValue, getCalendarNames, getFirstDayOfWeek, parseDateValue } from '../engine/DateFormat';
import { ITaskJsonField, ITaskJsonForm, TASK_JSON_NO, TASK_JSON_YES, TaskJsonErrors } from '../engine/TaskJson';
import { FormContext } from './FormContext';

const classes = mergeStyleSets({
  yesNo: { display: 'flex', gap: 16 },
  error: { color: '#a4262c', fontSize: 12, paddingTop: 4 }
});

export interface ITaskJsonFieldsProps {
  form: ITaskJsonForm;
  values: Record<string, string>;
  errors: TaskJsonErrors;
  readOnly: boolean;
  onChange: (name: string, value: string) => void;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIsoDate(value: string): Date | undefined {
  const match: RegExpExecArray | null = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

export const TaskJsonFields: React.FC<ITaskJsonFieldsProps> = (props) => {
  const { form, values, errors, readOnly } = props;
  const { cultureName, uiCultureName } = React.useContext(FormContext);

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

  const errorText = (field: ITaskJsonField): string | undefined =>
    errors[field.name] === 'required' ? strings.RequiredField : errors[field.name] === 'number' ? strings.TaskJsonInvalidNumber : undefined;

  const renderField = (field: ITaskJsonField): JSX.Element => {
    const value: string = values[field.name] ?? '';
    const set = (next: string): void => props.onChange(field.name, next);
    switch (field.type) {
      case 'yesno':
        return (
          <ChoiceGroup
            label={field.label}
            required={field.required}
            disabled={readOnly}
            selectedKey={value || null}
            options={[
              { key: TASK_JSON_YES, text: strings.Yes },
              { key: TASK_JSON_NO, text: strings.No }
            ]}
            styles={{ flexContainer: classes.yesNo }}
            onChange={(_, option) => option && set(String(option.key))}
          />
        );
      case 'date':
        return (
          <DatePicker
            label={field.label}
            isRequired={field.required}
            disabled={readOnly}
            value={fromIsoDate(value)}
            allowTextInput
            strings={pickerStrings}
            firstDayOfWeek={getFirstDayOfWeek(cultureName)}
            formatDate={(date) => (date ? formatDateValue(date, cultureName, true) : '')}
            parseDateFromString={(text) => parseDateValue(text, cultureName) ?? null}
            onSelectDate={(date) => set(date ? toIsoDate(date) : '')}
            textField={{ errorMessage: errorText(field) }}
          />
        );
      case 'choice': {
        const options = field.options.map((option) => ({ key: option.value, text: option.label }));
        // A listában nem szereplő (korábban mentett) érték is látsszon.
        if (value !== '' && !field.options.some((option) => option.value === value)) {
          options.push({ key: value, text: value });
        }
        return (
          <Dropdown
            label={field.label}
            required={field.required}
            disabled={readOnly}
            placeholder={strings.TaskJsonChoicePlaceholder}
            options={options}
            selectedKey={value || null}
            errorMessage={errorText(field)}
            onChange={(_, option) => option && set(String(option.key))}
          />
        );
      }
      default:
        return (
          <TextField
            label={field.label}
            required={field.required}
            readOnly={readOnly}
            multiline={field.type === 'multiline'}
            autoAdjustHeight={field.type === 'multiline'}
            rows={field.type === 'multiline' ? 4 : undefined}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            value={value}
            errorMessage={errorText(field)}
            onChange={(_, next) => set(next ?? '')}
          />
        );
    }
  };

  return (
    <>
      {form.fields.map((field) => (
        <div key={field.name}>
          {renderField(field)}
          {/* A választógomboknak nincs saját hibaüzenete, ezért itt jelenik meg. */}
          {field.type === 'yesno' && errorText(field) && (
            <div role="alert" className={classes.error}>
              {errorText(field)}
            </div>
          )}
        </div>
      ))}
    </>
  );
};
