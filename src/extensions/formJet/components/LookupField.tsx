// Lookup / LookupMulti mező a hivatkozott lista elemeiből: egyértékűnél legördülő lista,
// többértékűnél a mező beállítása szerint mindig nyitott jelölőnégyzetes lista vagy lenyíló lista.
// Az érték form-string (engine/LookupValue.ts).

import * as React from 'react';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Label } from '@fluentui/react/lib/Label';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { IResolvedField } from '../engine/LayoutResolver';
import { parseLookupValue, serializeLookupValue } from '../engine/LookupValue';
import { LOOKUP_CHECKLIST_MAX } from '../models/IFormConfig';
import * as LookupService from '../services/LookupService';

const EMPTY_KEY: string = '';

const classes = mergeStyleSets({
  // Többértékű mező: a lista a teljes magasságában látszik, görgetés nélkül.
  checkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    border: '1px solid #8a8886',
    borderRadius: 2,
    background: '#ffffff'
  },
  readOnlyValue: { padding: '6px 0', minHeight: 20, wordBreak: 'break-word' },
  hint: { fontSize: 12, color: '#605e5c', marginTop: 4 },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

export interface ILookupFieldProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export const LookupField: React.FC<ILookupFieldProps> = (props) => {
  const { field, value, error } = props;
  const { schema } = field;
  const multiple: boolean = schema.TypeAsString === 'LookupMulti';
  const listId: string | undefined = schema.LookupListId;
  const showField: string | undefined = schema.LookupField;

  const [data, setData] = React.useState<LookupService.ILookupOptions | undefined>();
  const [loadFailed, setLoadFailed] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!listId) {
      return;
    }
    let cancelled: boolean = false;
    LookupService.getLookupOptions(listId, showField)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listId, showField]);

  const selected: number[] = React.useMemo(() => parseLookupValue(value), [value]);

  const options: IDropdownOption[] = React.useMemo(() => {
    const known: LookupService.ILookupOption[] = data?.options ?? [];
    const result: IDropdownOption[] = known.map((option) => ({ key: option.id, text: option.text }));
    // A kiválasztott, de a listában nem szereplő elem (törölt, vagy a betöltési korláton túli) is látsszon.
    selected.forEach((id) => {
      if (!known.some((option) => option.id === id)) {
        result.push({ key: id, text: `#${id}` });
      }
    });
    return !multiple && !field.required ? [{ key: EMPTY_KEY, text: '' }, ...result] : result;
  }, [data, selected, multiple, field.required]);

  if (field.readOnly) {
    const names: string = selected
      .map((id) => String(options.filter((option) => option.key === id)[0]?.text ?? `#${id}`))
      .join('; ');
    return (
      <div>
        <Label>{field.label}</Label>
        <div className={classes.readOnlyValue}>{names || '–'}</div>
      </div>
    );
  }

  const loading: boolean = !data && !loadFailed;

  const toggle = (id: number, checked: boolean): void => {
    const next: number[] = checked ? [...selected, id] : selected.filter((item) => item !== id);
    props.onChange(serializeLookupValue(next, true));
  };

  // Megjelenítés többértékűnél: a mező beállítása dönt; `auto` módban az elemszám, amint betöltődött.
  let asChecklist: boolean | undefined;
  if (field.lookupDisplay === 'auto') {
    asChecklist = data ? options.length <= LOOKUP_CHECKLIST_MAX : undefined;
  } else {
    asChecklist = field.lookupDisplay === 'checklist';
  }

  const message: string | undefined = error ?? (loadFailed ? strings.LookupLoadFailed : undefined);

  return (
    <div>
      {multiple && loading && asChecklist === undefined ? (
        <Dropdown label={field.label} required={field.required} disabled placeholder={strings.Loading} options={[]} />
      ) : multiple && asChecklist === false ? (
        <Dropdown
          label={field.label}
          required={field.required}
          multiSelect
          placeholder={loading ? strings.Loading : field.placeholder}
          options={options}
          selectedKeys={selected}
          onChange={(_, option) => option && toggle(Number(option.key), !!option.selected)}
        />
      ) : multiple ? (
        <>
          <Label required={field.required}>{field.label}</Label>
          <div className={classes.checkList} role="group" aria-label={field.label}>
            {loading && <span className={classes.hint}>{strings.Loading}</span>}
            {options.map((option) => (
              <Checkbox
                key={option.key}
                label={option.text}
                checked={selected.indexOf(Number(option.key)) !== -1}
                onChange={(_, checked) => toggle(Number(option.key), !!checked)}
              />
            ))}
          </div>
        </>
      ) : (
        <Dropdown
          label={field.label}
          required={field.required}
          placeholder={loading ? strings.Loading : field.placeholder}
          options={options}
          selectedKey={selected.length > 0 ? selected[0] : field.required ? null : EMPTY_KEY}
          onChange={(_, option) =>
            option && props.onChange(option.key === EMPTY_KEY ? '' : serializeLookupValue([Number(option.key)], false))
          }
        />
      )}
      {data?.hasMore && (
        <div className={classes.hint}>{format(strings.LookupTooMany, LookupService.LOOKUP_OPTION_LIMIT)}</div>
      )}
      {message && (
        <div className={classes.error} role="alert">
          {message}
        </div>
      )}
    </div>
  );
};
