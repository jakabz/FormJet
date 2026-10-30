// A kapcsolódó elemek feladatának felugró ablaka: cím, leírás, további mezők, megjegyzés és a gombszabályok szerinti
// gombok. A gomb a feladat (és ha be van állítva, az eredeti elem) mezőit menti, form-stringekkel. Megtekintéskor
// (readOnly) minden csak olvasható, és csak a Bezárás gomb látszik.
// Külön csomagrészként töltődik be (a RelatedItems React.lazy-vel).

import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { ATTACHMENTS_FIELD } from '../engine/Attachments';
import { format } from '../engine/EngineStrings';
import { IResolvedField, isEditableField, resolveFieldValue } from '../engine/LayoutResolver';
import { resolveTemplate } from '../engine/ListCommands';
import { pickTaskButtons, taskConditionValues } from '../engine/RelatedList';
import { FormValues, IFieldSchema } from '../models/IFieldSchema';
import { IRelatedTaskConfig, ITaskButton } from '../models/IFormConfig';
import * as RelatedListService from '../services/RelatedListService';
import { EMPTY_ATTACHMENTS, FormContext, IFormContext } from './FormContext';
import { FieldRenderer } from './FieldRenderer';

const DIALOG_WIDTH: number = 640;
const DEFAULT_TITLE_FIELD: string = 'Title';
/** A felugró ablakban nem szerkeszthető típusok (feltöltést igényelnek). */
const NOT_EDITABLE_TYPES: string[] = [ATTACHMENTS_FIELD, 'Thumbnail'];

const classes = mergeStyleSets({
  body: { display: 'flex', flexDirection: 'column', gap: 12 },
  description: { whiteSpace: 'pre-wrap', color: '#323130' },
  hint: { fontSize: 12, color: '#605e5c', fontStyle: 'italic' }
});

export interface ITaskDialogProps {
  listId: string;
  taskId: number;
  task: IRelatedTaskConfig;
  /** Megtekintés: a mezők és a megjegyzés csak olvashatók, a gombszabályok gombjai nem jelennek meg. */
  readOnly?: boolean;
  onDismiss: () => void;
  /** Sikeres mentés után (a felsorolás frissítéséhez). */
  onCompleted: () => void;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback;
}

/** A feladat egy mezője a FieldRenderer számára (a felugró ablakban nincs feltétel, stílus és kötelezőség). */
function taskField(schema: IFieldSchema, editable: boolean): IResolvedField {
  return {
    name: schema.InternalName,
    schema,
    label: schema.Title,
    lookupDisplay: 'auto',
    attachmentsDisplay: 'list',
    colSpan: 1,
    visible: true,
    readOnly: !editable || !isEditableField(schema) || NOT_EDITABLE_TYPES.indexOf(schema.TypeAsString) !== -1,
    required: false,
    style: {}
  };
}

const TaskDialog: React.FC<ITaskDialogProps> = (props) => {
  const { listId, taskId, task, readOnly } = props;
  const context: IFormContext = React.useContext(FormContext);
  const [schema, setSchema] = React.useState<IFieldSchema[] | undefined>();
  const [data, setData] = React.useState<RelatedListService.ITaskData | undefined>();
  const [values, setValues] = React.useState<FormValues>({});
  const [comment, setComment] = React.useState<string>('');
  const [commentError, setCommentError] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState<boolean>(false);
  // A feladat már mentve, de az elem módosítása nem sikerült: csak a bezárás marad (a feladat ne mentődjön kétszer).
  const [taskSaved, setTaskSaved] = React.useState<boolean>(false);
  // Ilyenkor ugyanannak a gombnak az elemre vonatkozó része újrapróbálható.
  const [retryButton, setRetryButton] = React.useState<ITaskButton | undefined>();

  React.useEffect(() => {
    let cancelled: boolean = false;
    RelatedListService.getListSchema(listId)
      .then(async (fields) => {
        const loaded: RelatedListService.ITaskData = await RelatedListService.loadTask(listId, taskId, fields);
        if (!cancelled) {
          setSchema(fields);
          setData(loaded);
          setValues(loaded.values);
          setComment(task.commentField ? loaded.values[task.commentField] ?? '' : '');
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(errorText(e, strings.TaskLoadFailed));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listId, taskId]);

  const byName = (name: string | undefined): IFieldSchema | undefined =>
    name ? (schema ?? []).filter((field) => field.InternalName === name)[0] : undefined;

  const buttons: ITaskButton[] = React.useMemo(
    () => (data && !readOnly ? pickTaskButtons(task, taskConditionValues(context.itemConditionValues, data.values)) : []),
    [data, task, readOnly, context.itemConditionValues]
  );

  // A felugró ablak mezői a saját értékeikkel jelennek meg; a feladatnak nincsenek mellékletei és függő képei.
  const taskContext: IFormContext = React.useMemo(
    () => ({
      ...context,
      itemId: taskId,
      sourceValues: data?.values ?? {},
      attachments: EMPTY_ATTACHMENTS,
      setAttachments: () => undefined,
      listUrl: undefined,
      pendingImages: {},
      setPendingImage: () => undefined,
      runButtonActions: () => Promise.resolve(),
      busy
    }),
    [context, taskId, data, busy]
  );

  const run = async (button: ITaskButton): Promise<void> => {
    if (!data || !schema) {
      return;
    }
    if (button.commentRequired && task.commentField && comment.trim() === '') {
      setCommentError(strings.TaskCommentRequired);
      return;
    }
    setCommentError(undefined);
    setError(undefined);
    setBusy(true);
    try {
      if (!taskSaved) {
        const changed: FormValues = {};
        // A kitölthető mezők közül a módosultak.
        (task.fields ?? []).forEach((item) => {
          const field: IFieldSchema | undefined = byName(item.field);
          if (field && !taskField(field, !!item.editable).readOnly && (values[item.field] ?? '') !== (data.values[item.field] ?? '')) {
            changed[item.field] = values[item.field] ?? '';
          }
        });
        if (task.commentField && comment !== (data.values[task.commentField] ?? '')) {
          changed[task.commentField] = comment;
        }
        // A gomb által beállított értékek; a `{Mező}` az eredeti elem mentett értéke.
        const now: Date = new Date();
        (button.taskValues ?? []).forEach((assignment) => {
          const field: IFieldSchema | undefined = byName(assignment.field);
          if (field) {
            changed[field.InternalName] = resolveFieldValue(
              field,
              resolveTemplate(assignment.value, context.itemConditionValues),
              context.cultureName,
              now,
              context.currentUser
            );
          }
        });
        if (Object.keys(changed).length > 0) {
          await RelatedListService.saveTask(listId, taskId, changed, data.modified);
        }
        setTaskSaved(true);
      }
      try {
        if ((button.itemValues ?? []).length > 0) {
          await context.applyItemValues(button.itemValues ?? []);
        }
      } catch (e) {
        props.onCompleted();
        setRetryButton(button);
        setError(format(strings.TaskItemSaveFailed, e instanceof Error ? e.message : String(e)));
        return;
      }
      props.onCompleted();
      props.onDismiss();
    } catch (e) {
      setError(e instanceof RelatedListService.TaskConflictError ? strings.TaskConflict : errorText(e, strings.TaskSaveFailed));
    } finally {
      setBusy(false);
    }
  };

  const titleField: IFieldSchema | undefined = byName(task.titleField ?? DEFAULT_TITLE_FIELD);
  const title: string = data && titleField ? data.displayValues[titleField.InternalName] || data.values[titleField.InternalName] || '' : '';
  const description: string =
    data && task.descriptionField ? data.displayValues[task.descriptionField] || data.values[task.descriptionField] || '' : '';

  return (
    <Dialog
      hidden={false}
      minWidth={DIALOG_WIDTH}
      maxWidth={DIALOG_WIDTH}
      onDismiss={busy ? undefined : props.onDismiss}
      dialogContentProps={{ type: DialogType.normal, title: title || format(strings.TaskTitleFallback, taskId) }}
      modalProps={{ isBlocking: true }}
    >
      <FormContext.Provider value={taskContext}>
        <div className={classes.body}>
          {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
          {!data && !error && <Spinner size={SpinnerSize.medium} label={strings.Loading} />}
          {data && description && <div className={classes.description}>{description}</div>}
          {data &&
            (task.fields ?? []).map((item) => {
              const field: IFieldSchema | undefined = byName(item.field);
              if (!field) {
                return undefined;
              }
              const resolved: IResolvedField = taskField(field, !!item.editable && !taskSaved && !readOnly);
              const value: string = values[item.field] ?? '';
              return (
                <FieldRenderer
                  key={item.field}
                  field={resolved}
                  value={value}
                  // A megjelenítendő szöveg csak a módosítatlan értékhez tartozik.
                  displayValue={value === (data.values[item.field] ?? '') ? data.displayValues[item.field] : undefined}
                  onChange={(name, next) => setValues((current) => ({ ...current, [name]: next }))}
                />
              );
            })}
          {data && task.commentField && (
            <TextField
              label={strings.TaskComment}
              multiline
              autoAdjustHeight
              rows={4}
              disabled={busy || taskSaved}
              readOnly={readOnly}
              value={comment}
              errorMessage={commentError}
              onChange={(_, v) => setComment(v ?? '')}
            />
          )}
          {data && !readOnly && buttons.length === 0 && <div className={classes.hint}>{strings.TaskNoButtons}</div>}
        </div>
      </FormContext.Provider>
      <DialogFooter>
        {!taskSaved &&
          buttons.map((button, index) => {
            const Button = button.primary ? PrimaryButton : DefaultButton;
            return (
              <Button key={index} text={button.label} disabled={busy || !data} onClick={() => run(button).catch(() => undefined)} />
            );
          })}
        {taskSaved && retryButton && (
          <PrimaryButton text={strings.TaskRetry} disabled={busy} onClick={() => run(retryButton).catch(() => undefined)} />
        )}
        {busy && <Spinner size={SpinnerSize.small} />}
        <DefaultButton text={taskSaved || readOnly ? strings.Close : strings.Cancel} disabled={busy} onClick={props.onDismiss} />
      </DialogFooter>
    </Dialog>
  );
};

export default TaskDialog;
