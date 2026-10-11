// Mellékletek: a meglévő fájlok listája (képeknél miniatűrrel, mérettel), hozzáadás fájlválasztóval vagy
// a fájlok ráhúzásával, és törlés. A változások csak a form mentésekor hajtódnak végre (FormHost.save);
// addig a FormContext tartja őket.

import * as React from 'react';
import { DefaultButton, IconButton } from '@fluentui/react/lib/Button';
import { Icon } from '@fluentui/react/lib/Icon';
import { Label } from '@fluentui/react/lib/Label';
import { Link } from '@fluentui/react/lib/Link';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { formatFileSize, isImageFileName, validateAttachmentName } from '../engine/Attachments';
import { format } from '../engine/EngineStrings';
import { IResolvedField } from '../engine/LayoutResolver';
import { getDecimalSeparator } from '../engine/NumberFormat';
import { FormContext, IAttachmentsState } from './FormContext';

const THUMB_SIZE: number = 40;
const THUMB_SIZE_COMPACT: number = 20;

const classes = mergeStyleSets({
  // A teljes mező ejtési cél: a keret csak fájl ráhúzásakor látszik.
  dropArea: { border: '2px dashed transparent', borderRadius: 4, margin: -6, padding: 4 },
  dropActive: { borderColor: '#0078d4', background: '#eff6fc' },
  list: { display: 'flex', flexDirection: 'column', gap: 4, margin: '0 0 8px', padding: 0, listStyle: 'none' },
  compact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 28, minWidth: 0 },
  chip: { padding: '2px 4px 2px 6px', background: '#f3f2f1', borderRadius: 14, gap: 6 },
  thumb: {
    flexShrink: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    objectFit: 'cover',
    border: '1px solid #edebe9',
    borderRadius: 2,
    background: '#ffffff'
  },
  thumbCompact: { width: THUMB_SIZE_COMPACT, height: THUMB_SIZE_COMPACT, borderRadius: '50%' },
  icon: { flexShrink: 0, width: THUMB_SIZE, textAlign: 'center', fontSize: 16, color: '#605e5c' },
  iconCompact: { width: 'auto', fontSize: 14 },
  text: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  textCompact: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  name: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 12, color: '#605e5c', whiteSpace: 'nowrap' },
  empty: { padding: '6px 0', color: '#605e5c' },
  actions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hiddenInput: { display: 'none' },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

/** A még fel nem töltött képfájl miniatűrje helyi (blob) címről. */
const LocalThumb: React.FC<{ file: File; className: string }> = ({ file, className }) => {
  const [url, setUrl] = React.useState<string | undefined>();
  React.useEffect(() => {
    const objectUrl: string = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? <img className={className} src={url} alt="" /> : <span className={className} />;
};

/** Fájlokat húznak-e (és nem például szöveget vagy a tervező egy elemét). */
function hasFiles(event: React.DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.prototype.indexOf.call(types, 'Files') !== -1;
}

export interface IAttachmentsFieldProps {
  field: IResolvedField;
  error?: string;
}

export const AttachmentsField: React.FC<IAttachmentsFieldProps> = (props) => {
  const { field, error } = props;
  const { attachments, setAttachments, cultureName } = React.useContext(FormContext);
  const input = React.useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = React.useState<string | undefined>();
  // A beágyazott elemek dragenter / dragleave eseményei miatt számoljuk, hogy a mező fölött vagyunk-e még.
  const dragDepth = React.useRef<number>(0);
  const [dropActive, setDropActive] = React.useState<boolean>(false);

  const kept = attachments.existing.filter((file) => attachments.removed.indexOf(file.name) === -1);
  const compact: boolean = field.attachmentsDisplay === 'compact';
  const itemClass: string = compact ? `${classes.item} ${classes.chip}` : classes.item;
  const thumbClass: string = compact ? `${classes.thumb} ${classes.thumbCompact}` : classes.thumb;
  const iconClass: string = compact ? `${classes.icon} ${classes.iconCompact}` : classes.icon;
  const textClass: string = compact ? `${classes.text} ${classes.textCompact}` : classes.text;
  const separator: string = getDecimalSeparator(cultureName);

  const addFiles = (files: FileList | null | undefined): void => {
    if (!files || files.length === 0) {
      return;
    }
    const next: IAttachmentsState = { ...attachments, added: attachments.added.slice() };
    const problems: string[] = [];
    for (let i: number = 0; i < files.length; i++) {
      const file: File = files[i];
      const taken: string[] = kept.map((item) => item.name).concat(next.added.map((item) => item.name));
      const problem = validateAttachmentName(file.name, taken);
      if (file.size === 0) {
        // Az üres fájl és a ráhúzott mappa is nulla méretű.
        problems.push(format(strings.AttachmentEmpty, file.name));
      } else if (problem === 'duplicate') {
        problems.push(format(strings.AttachmentDuplicate, file.name));
      } else if (problem === 'invalid') {
        problems.push(format(strings.AttachmentInvalidName, file.name));
      } else {
        next.added.push(file);
      }
    }
    setRejected(problems.length > 0 ? problems.join(' ') : undefined);
    setAttachments(next);
  };

  const canDrop: boolean = !field.readOnly;
  const dropHandlers = canDrop
    ? {
        onDragEnter: (event: React.DragEvent): void => {
          if (hasFiles(event)) {
            event.preventDefault();
            dragDepth.current++;
            setDropActive(true);
          }
        },
        onDragOver: (event: React.DragEvent): void => {
          if (hasFiles(event)) {
            // Enélkül a böngésző megnyitná a fájlt.
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }
        },
        onDragLeave: (event: React.DragEvent): void => {
          if (hasFiles(event)) {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) {
              setDropActive(false);
            }
          }
        },
        onDrop: (event: React.DragEvent): void => {
          if (hasFiles(event)) {
            event.preventDefault();
            dragDepth.current = 0;
            setDropActive(false);
            addFiles(event.dataTransfer.files);
          }
        }
      }
    : {};

  const renderText = (name: string, url: string | undefined, meta: string): JSX.Element => (
    <span className={textClass}>
      {url ? (
        <Link className={classes.name} href={url} target="_blank" rel="noopener noreferrer" title={name}>
          {name}
        </Link>
      ) : (
        <span className={classes.name} title={name}>
          {name}
        </span>
      )}
      {meta !== '' && <span className={classes.meta}>{meta}</span>}
    </span>
  );

  const message: string | undefined = error ?? rejected;

  return (
    <div className={`${classes.dropArea} ${dropActive ? classes.dropActive : ''}`} {...dropHandlers}>
      <Label required={field.required}>{field.label}</Label>
      {kept.length === 0 && attachments.added.length === 0 ? (
        <div className={classes.empty}>{strings.AttachmentsNone}</div>
      ) : (
        <ul className={compact ? `${classes.list} ${classes.compact}` : classes.list}>
          {kept.map((file) => (
            <li key={`e:${file.name}`} className={itemClass}>
              {isImageFileName(file.name) && file.url ? (
                <img className={thumbClass} src={file.url} alt="" loading="lazy" />
              ) : (
                <Icon className={iconClass} iconName="Attach" />
              )}
              {renderText(file.name, file.url || undefined, formatFileSize(file.size, separator))}
              {!field.readOnly && (
                <IconButton
                  iconProps={{ iconName: 'Delete' }}
                  title={format(strings.AttachmentRemove, file.name)}
                  ariaLabel={format(strings.AttachmentRemove, file.name)}
                  onClick={() => setAttachments({ ...attachments, removed: [...attachments.removed, file.name] })}
                />
              )}
            </li>
          ))}
          {attachments.added.map((file) => (
            <li key={`a:${file.name}`} className={itemClass}>
              {isImageFileName(file.name) ? (
                <LocalThumb file={file} className={thumbClass} />
              ) : (
                <Icon className={iconClass} iconName="Attach" />
              )}
              {renderText(file.name, undefined, `${formatFileSize(file.size, separator)} ${strings.AttachmentPending}`)}
              {!field.readOnly && (
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  title={format(strings.AttachmentRemove, file.name)}
                  ariaLabel={format(strings.AttachmentRemove, file.name)}
                  onClick={() =>
                    setAttachments({ ...attachments, added: attachments.added.filter((item) => item !== file) })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {!field.readOnly && (
        <>
          <input
            ref={input}
            className={classes.hiddenInput}
            type="file"
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              // Ugyanaz a fájl újra kiválasztható legyen.
              event.target.value = '';
            }}
          />
          <div className={classes.actions}>
            <DefaultButton
              iconProps={{ iconName: 'Attach' }}
              text={strings.AttachmentAdd}
              onClick={() => input.current?.click()}
            />
            <span className={classes.meta}>{dropActive ? strings.AttachmentDropActive : strings.AttachmentDropHint}</span>
          </div>
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
