// Rich text Note mező: TipTap szerkesztő Fluent eszköztárral.
// Az érték form-string: a FieldValuesForEdit által adott HTML; üres tartalom = üres szöveg.
// A HTML-t a TipTap sémája értelmezi (nincs innerHTML), így csak az ismert elemek jelennek meg.
// Külön csomagrészbe (chunk) kerül: a FieldRenderer React.lazy-vel tölti be.

import * as React from 'react';
import { DefaultButton, IconButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { Label } from '@fluentui/react/lib/Label';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';
import { Image } from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';

import * as strings from 'FormJetFormCustomizerStrings';

const LINE_HEIGHT: number = 20;
const DEFAULT_LINES: number = 6;

const classes = mergeStyleSets({
  box: {
    border: '1px solid #605e5c',
    borderRadius: 2,
    background: '#ffffff',
    selectors: {
      ':hover': { borderColor: '#323130' },
      ':focus-within': { borderColor: '#0078d4', boxShadow: 'inset 0 0 0 1px #0078d4' }
    }
  },
  boxError: { borderColor: '#a4262c' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 2, padding: 2, borderBottom: '1px solid #edebe9' },
  separator: { width: 1, margin: '4px 4px', background: '#edebe9' },
  content: {
    selectors: {
      '& .tiptap': { padding: '6px 8px', outline: 'none', wordBreak: 'break-word', lineHeight: `${LINE_HEIGHT}px` },
      '& .tiptap > :first-child': { marginTop: 0 },
      '& .tiptap > :last-child': { marginBottom: 0 },
      '& .tiptap p': { margin: '0 0 8px' },
      '& .tiptap h1, & .tiptap h2, & .tiptap h3': { margin: '12px 0 8px', lineHeight: '1.3' },
      '& .tiptap ul, & .tiptap ol': { margin: '0 0 8px', paddingLeft: 24 },
      '& .tiptap li p': { margin: 0 },
      '& .tiptap a': { color: '#0078d4' },
      '& .tiptap blockquote': { margin: '0 0 8px', paddingLeft: 12, borderLeft: '3px solid #c8c6c4' },
      '& .tiptap img': { maxWidth: '100%', height: 'auto' },
      '& .tiptap table': { borderCollapse: 'collapse', margin: '0 0 8px', maxWidth: '100%' },
      '& .tiptap th, & .tiptap td': { border: '1px solid #c8c6c4', padding: '4px 8px', verticalAlign: 'top' }
    }
  },
  readOnly: { selectors: { '& .tiptap': { padding: '6px 0' } } },
  description: { fontSize: 12, color: '#605e5c', marginTop: 4 },
  error: { fontSize: 12, color: '#a4262c', marginTop: 4 }
});

export interface IRichTextFieldProps {
  label: string;
  /** Form-string érték (HTML). */
  value: string;
  required?: boolean;
  readOnly?: boolean;
  description?: string;
  error?: string;
  /** A szerkesztő minimális magassága sorokban. */
  lines?: number;
  onChange: (value: string) => void;
}

const MEDIA_NODES: string[] = ['image', 'table', 'horizontalRule'];

/** Üres-e a tartalom: nincs szöveg (a sortörés és a nulla szélességű szóköz nem számít), se kép, se táblázat. */
function isBlank(editor: Editor): boolean {
  if (editor.isEmpty) {
    return true;
  }
  if (editor.getText().replace(/[\s\u200b]/g, '') !== '') {
    return false;
  }
  let hasMedia: boolean = false;
  editor.state.doc.descendants((node) => {
    if (MEDIA_NODES.indexOf(node.type.name) !== -1) {
      hasMedia = true;
    }
    return !hasMedia;
  });
  return !hasMedia;
}

function toValue(editor: Editor): string {
  return isBlank(editor) ? '' : editor.getHTML();
}

interface IToolbarProps {
  editor: Editor;
  onEditLink: () => void;
}

const Toolbar: React.FC<IToolbarProps> = ({ editor, onEditLink }) => {
  const button = (iconName: string, title: string, run: () => void, checked?: boolean, disabled?: boolean): JSX.Element => (
    <IconButton
      key={iconName}
      iconProps={{ iconName }}
      title={title}
      ariaLabel={title}
      checked={checked}
      disabled={disabled}
      // A gomb ne vegye el a fókuszt (és a kijelölést) a szerkesztőtől.
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    />
  );
  return (
    <div className={classes.toolbar} role="toolbar">
      {button('Bold', strings.RteBold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {button('Italic', strings.RteItalic, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {button(
        'Underline',
        strings.RteUnderline,
        () => editor.chain().focus().toggleUnderline().run(),
        editor.isActive('underline')
      )}
      {button(
        'Strikethrough',
        strings.RteStrike,
        () => editor.chain().focus().toggleStrike().run(),
        editor.isActive('strike')
      )}
      <span className={classes.separator} />
      {button(
        'Header2',
        strings.RteHeading,
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        editor.isActive('heading', { level: 2 })
      )}
      {button(
        'BulletedList',
        strings.RteBulletList,
        () => editor.chain().focus().toggleBulletList().run(),
        editor.isActive('bulletList')
      )}
      {button(
        'NumberedList',
        strings.RteNumberedList,
        () => editor.chain().focus().toggleOrderedList().run(),
        editor.isActive('orderedList')
      )}
      <span className={classes.separator} />
      {button('Link', strings.RteLink, onEditLink, editor.isActive('link'))}
      {button(
        'RemoveLink',
        strings.RteRemoveLink,
        () => editor.chain().focus().extendMarkRange('link').unsetLink().run(),
        false,
        !editor.isActive('link')
      )}
      {button('ClearFormatting', strings.RteClearFormatting, () =>
        editor.chain().focus().unsetAllMarks().clearNodes().run()
      )}
      <span className={classes.separator} />
      {button('Undo', strings.RteUndo, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
      {button('Redo', strings.RteRedo, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
    </div>
  );
};

const RichTextField: React.FC<IRichTextFieldProps> = (props) => {
  const { label, value, required, readOnly, description, error } = props;
  const [linkUrl, setLinkUrl] = React.useState<string | undefined>();

  // A szerkesztő egyszer jön létre; a friss onChange-et és az utoljára kiadott értéket ref tartja.
  const onChangeRef = React.useRef(props.onChange);
  onChangeRef.current = props.onChange;
  const lastValue = React.useRef<string>(value);

  const editor: Editor | null = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          defaultProtocol: 'https',
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' }
        }
      }),
      // Táblázat és kép: eszköztár nincs hozzájuk, de a meglévő tartalom megmarad.
      TableKit,
      Image
    ],
    content: value,
    editable: !readOnly,
    // Az eszköztár gombjainak állapota (aktív / tiltott) minden változáskor frissüljön.
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': label } },
    onUpdate: ({ editor: current }) => {
      const next: string = toValue(current);
      lastValue.current = next;
      onChangeRef.current(next);
    }
  });

  // Kívülről érkező érték (újratöltés, kezdőérték): a szerkesztő tartalmát hozzá igazítjuk.
  React.useEffect(() => {
    if (editor && value !== lastValue.current) {
      lastValue.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  React.useEffect(() => {
    if (editor && editor.isEditable === !!readOnly) {
      editor.setEditable(!readOnly, false);
    }
  }, [editor, readOnly]);

  const openLinkDialog = (): void => {
    const href: unknown = editor?.getAttributes('link').href;
    setLinkUrl(typeof href === 'string' ? href : '');
  };

  const applyLink = (): void => {
    const href: string = (linkUrl ?? '').trim();
    setLinkUrl(undefined);
    if (!editor) {
      return;
    }
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
  };

  const minHeight: number = (props.lines || DEFAULT_LINES) * LINE_HEIGHT + 12;

  return (
    <div>
      <Label required={required && !readOnly}>{label}</Label>
      {readOnly ? (
        <EditorContent editor={editor} className={`${classes.content} ${classes.readOnly}`} />
      ) : (
        <div className={`${classes.box} ${error ? classes.boxError : ''}`}>
          {editor && <Toolbar editor={editor} onEditLink={openLinkDialog} />}
          <EditorContent
            editor={editor}
            className={classes.content}
            style={{ minHeight, cursor: 'text' }}
            onClick={() => editor && !editor.isFocused && editor.commands.focus()}
          />
        </div>
      )}
      {description && <div className={classes.description}>{description}</div>}
      {error && (
        <div className={classes.error} role="alert">
          {error}
        </div>
      )}

      <Dialog
        hidden={linkUrl === undefined}
        onDismiss={() => setLinkUrl(undefined)}
        dialogContentProps={{ type: DialogType.normal, title: strings.RteLink }}
      >
        <TextField
          label={strings.RteLinkUrl}
          placeholder="https://"
          value={linkUrl ?? ''}
          onChange={(_, next) => setLinkUrl(next ?? '')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              applyLink();
            }
          }}
        />
        <DialogFooter>
          <PrimaryButton text={strings.Apply} onClick={applyLink} />
          <DefaultButton text={strings.Cancel} onClick={() => setLinkUrl(undefined)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
};

export default RichTextField;
