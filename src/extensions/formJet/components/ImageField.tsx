// Kép (Thumbnail) mező: előnézet, kép kiválasztása, cseréje és törlése.
// A kiválasztott kép a form mentésekor töltődik fel (FormHost.save); addig a FormContext tartja.

import * as React from 'react';
import { DefaultButton } from '@fluentui/react/lib/Button';
import { Label } from '@fluentui/react/lib/Label';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { createPendingImageValue, getImageUrl, IImageData, parseImageValue } from '../engine/ImageValue';
import { IResolvedField } from '../engine/LayoutResolver';
import { FormContext } from './FormContext';

const classes = mergeStyleSets({
  preview: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: 200,
    marginBottom: 8,
    border: '1px solid #edebe9',
    borderRadius: 2,
    background: '#ffffff'
  },
  fileName: { padding: '6px 0', wordBreak: 'break-word' },
  empty: { padding: '6px 0', color: '#605e5c' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  hiddenInput: { display: 'none' },
  hint: { fontSize: 12, color: '#605e5c', marginTop: 4 },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

export interface IImageFieldProps {
  field: IResolvedField;
  /** Form-string érték. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export const ImageField: React.FC<IImageFieldProps> = (props) => {
  const { field, value, error } = props;
  const { itemId, listUrl, pendingImages, setPendingImage } = React.useContext(FormContext);
  const input = React.useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = React.useState<string | undefined>();

  const image: IImageData | undefined = React.useMemo(() => parseImageValue(value), [value]);
  const pendingFile: File | undefined = image?.pending ? pendingImages[field.name] : undefined;

  // A még fel nem töltött kép előnézete helyi (blob) címről.
  const [localUrl, setLocalUrl] = React.useState<string | undefined>();
  React.useEffect(() => {
    if (!pendingFile) {
      setLocalUrl(undefined);
      return;
    }
    const url: string = URL.createObjectURL(pendingFile);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const src: string | undefined = image?.pending ? localUrl : image ? getImageUrl(image, listUrl, itemId) : undefined;

  const pick = (file: File | undefined): void => {
    if (!file) {
      return;
    }
    if (file.type.indexOf('image/') !== 0 || file.size === 0) {
      setRejected(strings.ImageInvalid);
      return;
    }
    setRejected(undefined);
    setPendingImage(field.name, file);
    props.onChange(createPendingImageValue(file.name));
  };

  const clear = (): void => {
    setRejected(undefined);
    setPendingImage(field.name, undefined);
    props.onChange('');
  };

  const message: string | undefined = error ?? rejected;

  return (
    <div>
      <Label required={field.required && !field.readOnly}>{field.label}</Label>
      {src ? (
        <img className={classes.preview} src={src} alt={image?.fileName ?? field.label} />
      ) : image && !image.pending ? (
        <div className={classes.fileName}>{image.fileName}</div>
      ) : (
        !image && <div className={classes.empty}>{strings.ImageNone}</div>
      )}
      {!field.readOnly && (
        <>
          <input
            ref={input}
            className={classes.hiddenInput}
            type="file"
            accept="image/*"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              // Ugyanaz a fájl újra kiválasztható legyen.
              event.target.value = '';
            }}
          />
          <div className={classes.actions}>
            <DefaultButton
              iconProps={{ iconName: 'Photo2Add' }}
              text={image ? strings.ImageReplace : strings.ImageAdd}
              onClick={() => input.current?.click()}
            />
            {image && <DefaultButton iconProps={{ iconName: 'Delete' }} text={strings.ImageRemove} onClick={clear} />}
          </div>
          {image?.pending && <div className={classes.hint}>{strings.ImagePending}</div>}
        </>
      )}
      {message && (
        <div className={classes.error} role="alert">
          {message}
        </div>
      )}
    </div>
  );
};
