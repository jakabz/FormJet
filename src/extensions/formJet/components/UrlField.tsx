// URL mező: webcím és megjelenő szöveg. Csak olvashatóként hivatkozás, képként formázott mezőnél kép.
// Az érték form-string (engine/UrlValue.ts).

import * as React from 'react';
import { Label } from '@fluentui/react/lib/Label';
import { Link } from '@fluentui/react/lib/Link';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { IResolvedField } from '../engine/LayoutResolver';
import { isSafeUrl, IUrlValue, parseUrlValue, serializeUrlValue } from '../engine/UrlValue';

const classes = mergeStyleSets({
  inputs: { display: 'flex', flexDirection: 'column', gap: 4 },
  readOnlyValue: { padding: '6px 0', minHeight: 20, wordBreak: 'break-word' },
  image: { display: 'block', maxWidth: '100%', maxHeight: 240 }
});

export interface IUrlFieldProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export const UrlField: React.FC<IUrlFieldProps> = (props) => {
  const { field, value, error } = props;
  const parsed: IUrlValue = React.useMemo(() => parseUrlValue(value), [value]);
  // A leírás cím nélkül nem menthető, ezért addig helyben tartjuk, amíg a cím üres.
  const [pendingDescription, setPendingDescription] = React.useState<string>('');
  const description: string = parsed.url === '' ? pendingDescription : parsed.description;

  if (field.readOnly) {
    const text: string = parsed.description || parsed.url;
    let content: React.ReactNode = text || '–';
    if (parsed.url !== '' && isSafeUrl(parsed.url)) {
      content = field.schema.UrlImage ? (
        <img className={classes.image} src={parsed.url} alt={parsed.description} />
      ) : (
        <Link href={parsed.url} target="_blank" rel="noopener noreferrer">
          {text}
        </Link>
      );
    }
    return (
      <div>
        <Label>{field.label}</Label>
        <div className={classes.readOnlyValue}>{content}</div>
      </div>
    );
  }

  const invalid: boolean = parsed.url !== '' && !isSafeUrl(parsed.url);

  return (
    <div>
      <Label required={field.required}>{field.label}</Label>
      <div className={classes.inputs}>
        <TextField
          ariaLabel={`${field.label} – ${strings.UrlAddress}`}
          placeholder={field.placeholder ?? strings.UrlAddressPlaceholder}
          value={parsed.url}
          errorMessage={error ?? (invalid ? strings.UrlInvalid : undefined)}
          onChange={(_, next) => {
            const url: string = next ?? '';
            if (url.trim() === '') {
              setPendingDescription(description);
            }
            props.onChange(serializeUrlValue({ url, description }));
          }}
        />
        <TextField
          ariaLabel={`${field.label} – ${strings.UrlDescription}`}
          placeholder={strings.UrlDescription}
          value={description}
          onChange={(_, next) => {
            if (parsed.url === '') {
              setPendingDescription(next ?? '');
            } else {
              props.onChange(serializeUrlValue({ url: parsed.url, description: next ?? '' }));
            }
          }}
        />
      </div>
    </div>
  );
};
