// Felügyelt metaadat mező: kifejezésválasztó a mező kifejezéskészletéből, gépelés közbeni szűréssel.
// Az érték form-string (engine/TaxonomyValue.ts).

import * as React from 'react';
import { Label } from '@fluentui/react/lib/Label';
import { IBasePickerSuggestionsProps, ITag, TagPicker } from '@fluentui/react/lib/Pickers';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { IResolvedField } from '../engine/LayoutResolver';
import { ITermOption, ITermRef, parseTaxonomyValue, serializeTaxonomyValue } from '../engine/TaxonomyValue';
import * as TaxonomyService from '../services/TaxonomyService';
import { FormContext } from './FormContext';

/** Ennyi javaslat jelenik meg egyszerre; a többihez szűkíteni kell a keresést. */
const MAX_SUGGESTIONS: number = 30;

const classes = mergeStyleSets({
  hint: { fontSize: 12, color: '#605e5c', marginTop: 4 },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

const SUGGESTIONS: IBasePickerSuggestionsProps = {
  noResultsFoundText: strings.TaxonomyNoResults,
  loadingText: strings.Loading
};

export interface ITaxonomyFieldProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export const TaxonomyField: React.FC<ITaxonomyFieldProps> = (props) => {
  const { field, value, error } = props;
  const { schema } = field;
  const { uiCultureName } = React.useContext(FormContext);
  const multiple: boolean = schema.TypeAsString === 'TaxonomyFieldTypeMulti';
  const termSetId: string | undefined = schema.TermSetId;
  const anchorId: string | undefined = schema.TermAnchorId;

  const [data, setData] = React.useState<TaxonomyService.ITermOptions | undefined>();
  const [loadFailed, setLoadFailed] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!termSetId) {
      return;
    }
    let cancelled: boolean = false;
    TaxonomyService.getTerms(termSetId, anchorId, uiCultureName)
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
  }, [termSetId, anchorId, uiCultureName]);

  const terms: ITermOption[] = data?.terms ?? [];
  const selected: ITermRef[] = React.useMemo(() => parseTaxonomyValue(value), [value]);

  // A mentett érték címkéje nem megbízható (lehet belső sorszám), ezért a készletből oldjuk fel.
  const labelOf = (term: ITermRef): string =>
    terms.filter((option) => option.id === term.id)[0]?.label || term.label || term.id;
  const selectedTags: ITag[] = selected.map((term) => ({ key: term.id, name: labelOf(term) }));

  const suggest = (filter: string, current?: ITag[]): ITag[] => {
    const text: string = filter.trim().toLowerCase();
    const taken: string[] = (current ?? []).map((tag) => String(tag.key));
    return terms
      .filter((term) => taken.indexOf(term.id) === -1 && (text === '' || term.path.toLowerCase().indexOf(text) !== -1))
      .slice(0, MAX_SUGGESTIONS)
      .map((term) => ({ key: term.id, name: term.path }));
  };

  const onChange = (items?: ITag[]): void => {
    const next: ITermRef[] = (items ?? []).map((tag) => {
      const id: string = String(tag.key);
      const option: ITermOption | undefined = terms.filter((term) => term.id === id)[0];
      const previous: ITermRef | undefined = selected.filter((term) => term.id === id)[0];
      return { id, label: option?.label ?? previous?.label ?? tag.name };
    });
    props.onChange(serializeTaxonomyValue(next, multiple));
  };

  if (field.readOnly) {
    return (
      <div>
        <Label>{field.label}</Label>
        <div>{selectedTags.map((tag) => tag.name).join('; ') || '–'}</div>
      </div>
    );
  }

  const message: string | undefined = error ?? (loadFailed ? strings.TaxonomyLoadFailed : undefined);
  const loading: boolean = !data && !loadFailed;

  return (
    <div>
      <Label required={field.required}>{field.label}</Label>
      <TagPicker
        selectedItems={selectedTags}
        itemLimit={multiple ? undefined : 1}
        onResolveSuggestions={suggest}
        onEmptyResolveSuggestions={(current) => suggest('', current)}
        onChange={onChange}
        // A javaslatokban a teljes útvonal látszik, a kiválasztott elemen csak a címke.
        onItemSelected={(item) => {
          const option: ITermOption | undefined = item ? terms.filter((term) => term.id === item.key)[0] : undefined;
          return item ? { key: item.key, name: option?.label ?? item.name } : null;
        }}
        getTextFromItem={(item) => item.name}
        pickerSuggestionsProps={SUGGESTIONS}
        styles={{ text: { background: '#ffffff' } }}
        inputProps={{
          'aria-label': field.label,
          placeholder:
            selectedTags.length === 0 ? (loading ? strings.Loading : field.placeholder ?? strings.TaxonomyPlaceholder) : undefined
        }}
      />
      {data?.hasMore && <div className={classes.hint}>{format(strings.TaxonomyTooMany, TaxonomyService.TERM_LIMIT)}</div>}
      {message && (
        <div className={classes.error} role="alert">
          {message}
        </div>
      )}
    </div>
  );
};
