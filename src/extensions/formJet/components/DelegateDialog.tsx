// A kapcsolódó elemek feladatának delegálása: felugró ablak személyválasztóval (ki kapja a feladatot) és indoklással.
// OK-ra a feladat delegált személy mezője, állapota és indoklás mezője mentődik form-stringekkel, ütközésvizsgálattal.
// Ha a feladat a megnyithatóság feltételét nem teljesíti (például elvégezték), vagy az állapota nincs a beállítottak
// között (statuses), nem delegálható.
// Külön csomagrészként töltődik be (a RelatedItems React.lazy-vel), a feladat felugró ablakával egy csomagban.

import * as React from 'react';
import { DefaultButton, PrimaryButton } from '@fluentui/react/lib/Button';
import { Dialog, DialogFooter, DialogType } from '@fluentui/react/lib/Dialog';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { TextField } from '@fluentui/react/lib/TextField';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { IResolvedField, resolveFieldValue } from '../engine/LayoutResolver';
import { delegationChanges, isDelegationAllowedForStatus, isTaskOpenable } from '../engine/RelatedList';
import { IFieldSchema } from '../models/IFieldSchema';
import { IRelatedTaskConfig, ITaskDelegationConfig } from '../models/IFormConfig';
import * as RelatedListService from '../services/RelatedListService';
import { FormContext, IFormContext } from './FormContext';
import { PeopleField } from './PeopleField';

const DIALOG_WIDTH: number = 520;
const DEFAULT_TITLE_FIELD: string = 'Title';
const USER_TYPES: string[] = ['User', 'UserMulti'];

const classes = mergeStyleSets({
  body: { display: 'flex', flexDirection: 'column', gap: 12 }
});

export interface IDelegateDialogProps {
  listId: string;
  taskId: number;
  task: IRelatedTaskConfig;
  delegation: ITaskDelegationConfig;
  onDismiss: () => void;
  /** Sikeres mentés után (a felsorolás frissítéséhez). */
  onCompleted: () => void;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback;
}

const DelegateDialog: React.FC<IDelegateDialogProps> = (props) => {
  const { listId, taskId, task, delegation } = props;
  const context: IFormContext = React.useContext(FormContext);
  const [schema, setSchema] = React.useState<IFieldSchema[] | undefined>();
  const [data, setData] = React.useState<RelatedListService.ITaskData | undefined>();
  const [delegatedTo, setDelegatedTo] = React.useState<string>('');
  const [comment, setComment] = React.useState<string>('');
  const [delegatedToError, setDelegatedToError] = React.useState<string | undefined>();
  const [commentError, setCommentError] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled: boolean = false;
    RelatedListService.getListSchema(listId)
      .then(async (fields) => {
        const loaded: RelatedListService.ITaskData = await RelatedListService.loadTask(listId, taskId, fields);
        if (!cancelled) {
          setSchema(fields);
          setData(loaded);
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

  const delegatedToField: IFieldSchema | undefined = byName(delegation.delegatedToField);
  const statusField: IFieldSchema | undefined = byName(delegation.statusField);
  const commentField: IFieldSchema | undefined = byName(delegation.commentField);
  // A beállításban szereplő, de a listán nem található (vagy nem személy) mező: a delegálás nem menthető.
  const missingField: string | undefined = !schema
    ? undefined
    : !delegatedToField || USER_TYPES.indexOf(delegatedToField.TypeAsString) === -1
      ? delegation.delegatedToField
      : delegation.statusField !== '' && !statusField
        ? delegation.statusField
        : delegation.commentField && !commentField
          ? delegation.commentField
          : undefined;
  // A megnyithatóság feltétele és a beállított állapotok is számítanak (a feladat a felsorolás óta változhatott).
  const allowed: boolean =
    !!data &&
    isTaskOpenable(task, data.values, context.itemConditionValues) &&
    isDelegationAllowedForStatus(delegation, data.values[delegation.statusField]);
  const canSubmit: boolean = !!data && allowed && !missingField && !busy;

  const peopleField: IResolvedField | undefined = delegatedToField && {
    name: delegatedToField.InternalName,
    schema: delegatedToField,
    label: strings.TaskDelegateTo,
    lookupDisplay: 'auto',
    attachmentsDisplay: 'list',
    colSpan: 1,
    visible: true,
    readOnly: busy,
    required: true,
    style: {}
  };

  const submit = async (): Promise<void> => {
    if (!data || !canSubmit) {
      return;
    }
    const noPerson: boolean = delegatedTo.trim() === '';
    const noComment: boolean = !!commentField && comment.trim() === '';
    setDelegatedToError(noPerson ? strings.TaskDelegateToRequired : undefined);
    setCommentError(noComment ? strings.TaskDelegateCommentRequired : undefined);
    if (noPerson || noComment) {
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      // Az állapot értéke a kezdőérték formátumában van; a mező típusa szerint alakítjuk form-stringgé.
      const status: string = statusField
        ? resolveFieldValue(statusField, delegation.statusValue, context.cultureName, new Date(), context.currentUser)
        : '';
      await RelatedListService.saveTask(listId, taskId, delegationChanges(delegation, delegatedTo, status, comment), data.modified);
      props.onCompleted();
      props.onDismiss();
    } catch (e) {
      setError(e instanceof RelatedListService.TaskConflictError ? strings.TaskConflict : errorText(e, strings.TaskSaveFailed));
    } finally {
      setBusy(false);
    }
  };

  const titleField: IFieldSchema | undefined = byName(task.titleField ?? DEFAULT_TITLE_FIELD);
  const taskTitle: string =
    (data && titleField ? data.displayValues[titleField.InternalName] || data.values[titleField.InternalName] : '') ||
    format(strings.TaskTitleFallback, taskId);

  return (
    <Dialog
      hidden={false}
      minWidth={DIALOG_WIDTH}
      maxWidth={DIALOG_WIDTH}
      onDismiss={busy ? undefined : props.onDismiss}
      dialogContentProps={{ type: DialogType.normal, title: format(strings.TaskDelegateTitle, taskTitle) }}
      modalProps={{ isBlocking: true }}
    >
      <div className={classes.body}>
        {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
        {!data && !error && <Spinner size={SpinnerSize.medium} label={strings.Loading} />}
        {missingField && <MessageBar messageBarType={MessageBarType.warning}>{format(strings.TaskDelegateFieldMissing, missingField)}</MessageBar>}
        {data && !allowed && <MessageBar messageBarType={MessageBarType.warning}>{strings.TaskDelegateNotAllowed}</MessageBar>}
        {data && allowed && !missingField && peopleField && (
          <>
            <PeopleField
              field={peopleField}
              value={delegatedTo}
              error={delegatedToError}
              onChange={(next) => {
                setDelegatedTo(next);
                setDelegatedToError(undefined);
              }}
            />
            {commentField && (
              <TextField
                label={strings.TaskDelegateComment}
                required
                multiline
                autoAdjustHeight
                rows={4}
                disabled={busy}
                value={comment}
                errorMessage={commentError}
                onChange={(_, v) => {
                  setComment(v ?? '');
                  setCommentError(undefined);
                }}
              />
            )}
          </>
        )}
      </div>
      <DialogFooter>
        {busy && <Spinner size={SpinnerSize.small} />}
        <PrimaryButton text={strings.TaskDelegateOk} disabled={!canSubmit} onClick={() => submit().catch(() => undefined)} />
        <DefaultButton text={strings.Cancel} disabled={busy} onClick={props.onDismiss} />
      </DialogFooter>
    </Dialog>
  );
};

export default DelegateDialog;
