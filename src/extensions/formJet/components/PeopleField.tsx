// User / UserMulti mező: Fluent személyválasztó a SharePoint névkeresőjével.
// Az érték form-string (engine/UserValue.ts).

import * as React from 'react';
import { Label } from '@fluentui/react/lib/Label';
import { IPersonaProps } from '@fluentui/react/lib/Persona';
import { IBasePickerSuggestionsProps, NormalPeoplePicker } from '@fluentui/react/lib/Pickers';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { IResolvedField } from '../engine/LayoutResolver';
import { IUserEntry, parseUserValue, serializeUserValue } from '../engine/UserValue';
import * as PeopleService from '../services/PeopleService';

const SEARCH_DELAY_MS: number = 300;

const classes = mergeStyleSets({
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

const SUGGESTIONS: IBasePickerSuggestionsProps = {
  noResultsFoundText: strings.PeopleNoResults,
  loadingText: strings.Loading
};

/** A személyválasztó eleme; a `userKey` a mentéskor visszaírt kulcs. */
interface IUserPersona extends IPersonaProps {
  userKey: string;
}

function toPersona(entry: IUserEntry): IUserPersona {
  return { userKey: entry.key, text: entry.text, secondaryText: entry.secondaryText };
}

export interface IPeopleFieldProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export const PeopleField: React.FC<IPeopleFieldProps> = (props) => {
  const { field, value, error } = props;
  const { schema } = field;
  const multiple: boolean = schema.TypeAsString === 'UserMulti';
  const [searchFailed, setSearchFailed] = React.useState<boolean>(false);

  const selected: IUserPersona[] = React.useMemo(() => parseUserValue(value).map(toPersona), [value]);

  const search = async (filter: string, current?: IPersonaProps[]): Promise<IPersonaProps[]> => {
    try {
      const found: IUserEntry[] = await PeopleService.searchPeople(filter, {
        allowGroups: !!schema.UserAllowGroups,
        sharePointGroupId: schema.UserSelectionGroup
      });
      setSearchFailed(false);
      const taken: string[] = ((current ?? []) as IUserPersona[]).map((persona) => persona.userKey);
      return found.filter((entry) => taken.indexOf(entry.key) === -1).map(toPersona);
    } catch {
      setSearchFailed(true);
      return [];
    }
  };

  const onChange = (items?: IPersonaProps[]): void => {
    const entries: IUserEntry[] = ((items ?? []) as IUserPersona[]).map((persona) => ({
      key: persona.userKey,
      text: persona.text ?? persona.userKey,
      secondaryText: persona.secondaryText
    }));
    props.onChange(serializeUserValue(entries));
  };

  const message: string | undefined = error ?? (searchFailed ? strings.PeopleSearchFailed : undefined);

  return (
    <div>
      <Label required={field.required}>{field.label}</Label>
      <NormalPeoplePicker
        selectedItems={selected}
        itemLimit={multiple ? undefined : 1}
        resolveDelay={SEARCH_DELAY_MS}
        onResolveSuggestions={search}
        onChange={onChange}
        getTextFromItem={(persona) => persona.text ?? ''}
        pickerSuggestionsProps={SUGGESTIONS}
        inputProps={{
          'aria-label': field.label,
          placeholder: selected.length === 0 ? field.placeholder ?? strings.PeoplePlaceholder : undefined
        }}
      />
      {message && (
        <div className={classes.error} role="alert">
          {message}
        </div>
      )}
    </div>
  );
};
