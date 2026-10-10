// A tervező szekciókártyájának „Kapcsolódó elemek” része.
// Csak a draft konfigurációt módosítja az onChange-en keresztül; a listákat és mezőket a szolgáltatásból olvassa.

import * as React from 'react';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import {
  DEFAULT_ROW_LIMIT,
  ID_FIELD,
  isMatchableType,
  MAX_ROW_LIMIT,
  MIN_ROW_LIMIT
} from '../engine/RelatedList';
import { IFieldSchema } from '../models/IFieldSchema';
import { IRelatedListConfig } from '../models/IFormConfig';
import * as RelatedListService from '../services/RelatedListService';

const classes = mergeStyleSets({
  root: { display: 'flex', flexDirection: 'column', gap: 8 },
  hint: { fontSize: 12, color: '#605e5c' }
});

/** A táblázat egyszerű szövegként jelenít meg, ezért a többsoros (HTML) mező nem választható oszlopnak. */
const NON_COLUMN_TYPES: string[] = ['Note'];

export interface IRelatedListEditorProps {
  value: IRelatedListConfig | undefined;
  /** Ennek a listának a mezői: ezekből választható a párosítás forrása. */
  schema: IFieldSchema[];
  onChange: (value: IRelatedListConfig | undefined) => void;
}

function fieldOption(name: string, title: string): IDropdownOption {
  return { key: name, text: title === name ? name : `${title} (${name})` };
}

export const RelatedListEditor: React.FC<IRelatedListEditorProps> = (props) => {
  const { value } = props;
  const enabled: boolean = value !== undefined;
  const listId: string = value?.listId ?? '';

  const [lists, setLists] = React.useState<RelatedListService.IListInfo[]>([]);
  const [fields, setFields] = React.useState<RelatedListService.IListFieldInfo[]>([]);
  const [error, setError] = React.useState<string | undefined>();
  const [limitText, setLimitText] = React.useState<string>(value?.rowLimit !== undefined ? String(value.rowLimit) : '');

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled: boolean = false;
    RelatedListService.getLists()
      .then((result) => {
        if (!cancelled) {
          setLists(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(strings.RelatedListsFailed);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  React.useEffect(() => {
    if (listId === '') {
      setFields([]);
      return;
    }
    let cancelled: boolean = false;
    RelatedListService.getListFields(listId)
      .then((result) => {
        if (!cancelled) {
          setFields(result);
          setError(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFields([]);
          setError(strings.RelatedLoadFailed);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const update = (patch: Partial<IRelatedListConfig>): void => {
    if (value) {
      props.onChange({ ...value, ...patch });
    }
  };

  const toggle = (
    <Checkbox
      label={strings.RelatedEnable}
      checked={enabled}
      onChange={(_, checked) =>
        props.onChange(checked ? { listId: '', matchField: '', sourceField: ID_FIELD, columns: [] } : undefined)
      }
    />
  );
  if (!value) {
    return toggle;
  }

  const listOptions: IDropdownOption[] = lists.map((list) => ({ key: list.id, text: list.title }));
  const matchOptions: IDropdownOption[] = fields
    .filter((field) => isMatchableType(field.type))
    .map((field) => fieldOption(field.name, field.title));
  const sourceOptions: IDropdownOption[] = [
    { key: ID_FIELD, text: strings.RelatedSourceId },
    ...props.schema
      .filter((field) => isMatchableType(field.TypeAsString))
      .map((field) => fieldOption(field.InternalName, field.Title))
  ];
  const columnFields: RelatedListService.IListFieldInfo[] = fields.filter(
    (field) => NON_COLUMN_TYPES.indexOf(field.type) === -1
  );
  const columnOptions: IDropdownOption[] = columnFields.map((field) => fieldOption(field.name, field.title));
  const sortOptions: IDropdownOption[] = [{ key: '', text: '' }, ...columnOptions];

  const onLimitChange = (text: string): void => {
    setLimitText(text);
    if (text.trim() === '') {
      update({ rowLimit: undefined });
      return;
    }
    const limit: number = Number(text);
    if (limit === Math.floor(limit) && limit >= MIN_ROW_LIMIT && limit <= MAX_ROW_LIMIT) {
      update({ rowLimit: limit });
    }
  };
  const limitNumber: number = Number(limitText);
  const limitInvalid: boolean =
    limitText.trim() !== '' &&
    !(limitNumber === Math.floor(limitNumber) && limitNumber >= MIN_ROW_LIMIT && limitNumber <= MAX_ROW_LIMIT);

  return (
    <div className={classes.root}>
      {toggle}
      {error && <MessageBar messageBarType={MessageBarType.warning}>{error}</MessageBar>}
      <Dropdown
        label={strings.RelatedList}
        options={listOptions}
        selectedKey={listId || null}
        // Másik lista választásakor a mezőkre vonatkozó beállítások érvényüket vesztik.
        onChange={(_, option) =>
          option && update({ listId: String(option.key), matchField: '', columns: [], sortField: undefined })
        }
      />
      <Dropdown
        label={strings.RelatedMatchField}
        disabled={listId === ''}
        options={matchOptions}
        selectedKey={value.matchField || null}
        onChange={(_, option) => option && update({ matchField: String(option.key) })}
      />
      <Dropdown
        label={strings.RelatedSourceField}
        options={sourceOptions}
        selectedKey={value.sourceField}
        onChange={(_, option) => option && update({ sourceField: String(option.key) })}
      />
      <div className={classes.hint}>{strings.RelatedMatchHint}</div>
      <Dropdown
        label={strings.RelatedColumns}
        disabled={listId === ''}
        multiSelect
        options={columnOptions}
        selectedKeys={value.columns}
        onChange={(_, option) => {
          if (!option) {
            return;
          }
          const key: string = String(option.key);
          // A kiválasztás sorrendje az oszlopok sorrendje.
          update({ columns: option.selected ? [...value.columns, key] : value.columns.filter((name) => name !== key) });
        }}
      />
      <Dropdown
        label={strings.RelatedSortField}
        disabled={listId === ''}
        options={sortOptions}
        selectedKey={value.sortField ?? ''}
        onChange={(_, option) => option && update({ sortField: String(option.key) || undefined })}
      />
      <Checkbox
        label={strings.RelatedSortDescending}
        checked={value.sortAscending === false}
        onChange={(_, checked) => update({ sortAscending: checked ? false : undefined })}
      />
      <TextField
        label={strings.RelatedRowLimit}
        placeholder={String(DEFAULT_ROW_LIMIT)}
        value={limitText}
        errorMessage={limitInvalid ? format(strings.StyleMaxWidthError, MIN_ROW_LIMIT, MAX_ROW_LIMIT) : undefined}
        onChange={(_, text) => onLimitChange(text ?? '')}
      />
      <Checkbox
        label={strings.RelatedShowNewButton}
        checked={!!value.showNewButton}
        onChange={(_, checked) => update({ showNewButton: checked || undefined })}
      />
    </div>
  );
};
