// Mellékletek: a meglévő fájlok listája, hozzáadás és törlés. A változások csak a form mentésekor
// hajtódnak végre (FormHost.save); addig a FormContext tartja őket.

import * as React from 'react';
import { DefaultButton, IconButton } from '@fluentui/react/lib/Button';
import { Icon } from '@fluentui/react/lib/Icon';
import { Label } from '@fluentui/react/lib/Label';
import { Link } from '@fluentui/react/lib/Link';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { validateAttachmentName } from '../engine/Attachments';
import { format } from '../engine/EngineStrings';
import { IResolvedField } from '../engine/LayoutResolver';
import { FormContext, IAttachmentsState } from './FormContext';

const classes = mergeStyleSets({
  list: { display: 'flex', flexDirection: 'column', gap: 2, margin: '0 0 8px', padding: 0, listStyle: 'none' },
  compact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { display: 'flex', alignItems: 'center', gap: 6, minHeight: 28, minWidth: 0 },
  chip: { padding: '0 4px 0 8px', background: '#f3f2f1', borderRadius: 14 },
  name: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pending: { fontSize: 12, color: '#605e5c', whiteSpace: 'nowrap' },
  empty: { padding: '6px 0', color: '#605e5c' },
  hiddenInput: { display: 'none' },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

export interface IAttachmentsFieldProps {
  field: IResolvedField;
  error?: string;
}

export const AttachmentsField: React.FC<IAttachmentsFieldProps> = (props) => {
  const { field, error } = props;
  const { attachments, setAttachments } = React.useContext(FormContext);
  const input = React.useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = React.useState<string | undefined>();

  const kept = attachments.existing.filter((file) => attachments.removed.indexOf(file.name) === -1);
  const compact: boolean = field.attachmentsDisplay === 'compact';
  const itemClass: string = compact ? `${classes.item} ${classes.chip}` : classes.item;

  const addFiles = (files: FileList | null): void => {
    if (!files) {
      return;
    }
    const next: IAttachmentsState = { ...attachments, added: attachments.added.slice() };
    const problems: string[] = [];
    for (let i: number = 0; i < files.length; i++) {
      const file: File = files[i];
      const taken: string[] = kept.map((item) => item.name).concat(next.added.map((item) => item.name));
      const problem = validateAttachmentName(file.name, taken);
      if (file.size === 0) {
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

  const message: string | undefined = error ?? rejected;

  return (
    <div>
      <Label required={field.required}>{field.label}</Label>
      {kept.length === 0 && attachments.added.length === 0 ? (
        <div className={classes.empty}>{strings.AttachmentsNone}</div>
      ) : (
        <ul className={compact ? `${classes.list} ${classes.compact}` : classes.list}>
          {kept.map((file) => (
            <li key={`e:${file.name}`} className={itemClass}>
              <Icon iconName="Attach" />
              {file.url ? (
                <Link className={classes.name} href={file.url} target="_blank" rel="noopener noreferrer" title={file.name}>
                  {file.name}
                </Link>
              ) : (
                <span className={classes.name} title={file.name}>
                  {file.name}
                </span>
              )}
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
              <Icon iconName="Attach" />
              <span className={classes.name} title={file.name}>
                {file.name}
              </span>
              <span className={classes.pending}>{strings.AttachmentPending}</span>
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
          <DefaultButton
            iconProps={{ iconName: 'Attach' }}
            text={strings.AttachmentAdd}
            onClick={() => input.current?.click()}
          />
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
