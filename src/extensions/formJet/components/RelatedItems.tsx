// Kapcsolódó elemek: egy másik lista párosított elemei csak olvasható táblázatban. Feladatkezelésnél a bejelentkezett
// felhasználóhoz rendelt (és megnyitható) sorok felugró ablakban elvégezhetők (Kitöltöm); ha a feladat megtekintése be van
// kapcsolva, a többi sor csak olvasható felugró ablakban megtekinthető (Megtekintem).

import * as React from 'react';
import { DefaultButton, IButtonStyles, IconButton } from '@fluentui/react/lib/Button';
import { DetailsList, DetailsListLayoutMode, IColumn, SelectionMode } from '@fluentui/react/lib/DetailsList';
import { Link } from '@fluentui/react/lib/Link';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { TooltipHost } from '@fluentui/react/lib/Tooltip';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { IResolvedField } from '../engine/LayoutResolver';
import { groupVariable } from '../engine/ConditionContext';
import {
  getRowLimit,
  ID_FIELD,
  isDelegationAllowedForStatus,
  isDelegationEnabled,
  isRelatedComplete,
  isTaskEnabled,
  isTaskOpenable
} from '../engine/RelatedList';
import { IRelatedListConfig } from '../models/IFormConfig';
import * as RelatedListService from '../services/RelatedListService';
import { FormContext } from './FormContext';

// A felugró ablak csak a feladat megnyitásakor kell; külön csomagrészként töltődik be.
const TaskDialog = React.lazy(() => import(/* webpackChunkName: 'formjet-task' */ './TaskDialog'));
const DelegateDialog = React.lazy(() => import(/* webpackChunkName: 'formjet-task' */ './DelegateDialog'));

const ACTION_COLUMN: string = '__task';
const ROW_BUTTON_STYLES: IButtonStyles = { root: { height: 24, width: 28 } };

const classes = mergeStyleSets({
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowButtons: { display: 'flex', gap: 2 },
  spacer: { flex: 1 },
  hint: { fontSize: 12, color: '#605e5c', padding: '6px 0' },
  // Új elemnél a helye látszik: itt jelennek meg majd a kapcsolódó elemek.
  placeholder: {
    fontSize: 13,
    color: '#605e5c',
    padding: '16px 12px',
    border: '1px dashed #c8c6c4',
    borderRadius: 4,
    textAlign: 'center',
    background: '#faf9f8'
  },
  table: { overflowX: 'auto' },
  // A többsoros szöveg sortörései megmaradnak.
  note: { whiteSpace: 'pre-wrap' }
});

export interface IRelatedItemsProps {
  field: IResolvedField;
  /** Tervező előnézet: a hiányos beállításra is figyelmeztet, és a feladatok nem nyithatók meg. */
  designing?: boolean;
}

function itemUrl(displayFormUrl: string, id: number): string {
  return `${displayFormUrl}${displayFormUrl.indexOf('?') === -1 ? '?' : '&'}ID=${id}`;
}

const EMPTY_CONFIG: IRelatedListConfig = { listId: '', matchField: '', sourceField: ID_FIELD, columns: [] };

export const RelatedItems: React.FC<IRelatedItemsProps> = (props) => {
  const config: IRelatedListConfig = props.field.related ?? EMPTY_CONFIG;
  const { itemId, sourceValues, itemConditionValues } = React.useContext(FormContext);
  const [data, setData] = React.useState<RelatedListService.IRelatedData | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState<boolean>(false);
  const [reloadCount, setReloadCount] = React.useState<number>(0);
  // A hozzárendelt sorok közül a megnyithatók (a feladat megnyithatóságának feltétele szerint).
  const [openable, setOpenable] = React.useState<number[]>([]);
  const [openTask, setOpenTask] = React.useState<{ id: number; readOnly: boolean } | undefined>();
  const [delegateTask, setDelegateTask] = React.useState<number | undefined>();

  const complete: boolean = isRelatedComplete(config);
  // A párosítás a mentett elem értékével történik, nem a formon éppen szerkesztett értékkel.
  const sourceValue: string | undefined =
    config.sourceField === ID_FIELD ? (itemId !== undefined ? String(itemId) : undefined) : sourceValues[config.sourceField];
  const configKey: string = JSON.stringify(config);

  React.useEffect(() => {
    if (!complete || itemId === undefined) {
      setData(undefined);
      setError(undefined);
      return;
    }
    let cancelled: boolean = false;
    setLoading(true);
    setError(undefined);
    RelatedListService.getRelatedItems(config, sourceValue)
      .then(async (result) => {
        // A megnyithatóság feltétele a feladat mezőit látja: ehhez a hozzárendelt feladatokat be kell tölteni.
        let ids: number[] = result.assignedIds;
        const task = config.task;
        if (task?.openWhen && ids.length > 0) {
          const schema = await RelatedListService.getListSchema(config.listId);
          const tasks = await Promise.all(ids.map((id) => RelatedListService.loadTask(config.listId, id, schema)));
          ids = ids.filter((_, index) => isTaskOpenable(task, tasks[index].values, itemConditionValues));
        }
        if (!cancelled) {
          setData(result);
          setOpenable(ids);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(undefined);
          setOpenable([]);
          setError(
            e instanceof RelatedListService.RelatedMatchFieldError
              ? format(strings.RelatedMatchFieldError, e.message)
              : strings.RelatedLoadFailed
          );
        }
      })
      .then(() => {
        if (!cancelled) {
          setLoading(false);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // A config tartalma a configKey-ben van; az objektum azonossága minden rendereléskor változhat.
  }, [configKey, complete, itemId, sourceValue, reloadCount]);

  const taskMode: boolean = isTaskEnabled(config);
  // Letiltva (vagy a tervezőben) a feladatok nem nyithatók meg, de a felsorolás látszik.
  const canOpen: boolean = taskMode && !props.field.readOnly && !props.designing;
  // A megtekintés nem módosít semmit, ezért letiltott elemnél is elérhető (a tervezőben nem).
  const viewMode: boolean = taskMode && !!config.task?.allowView;
  // Delegálás: a beállított csoport tagjai minden sornál (a tagságot a FormHost kérdezi le előre). Nem jogosultsági határ.
  const delegation = taskMode && isDelegationEnabled(config.task) ? config.task?.delegation : undefined;
  const delegateMode: boolean = !!delegation && itemConditionValues[groupVariable(delegation.groupId ?? 0)] === '1';

  const columns: IColumn[] = React.useMemo(() => {
    const result: IColumn[] = (data?.columns ?? []).map((column, index) => ({
      key: column.name,
      name: column.title,
      fieldName: column.name,
      minWidth: 80,
      maxWidth: index === 0 ? 320 : 200,
      isResizable: true,
      isMultiline: true,
      onRender: (row: RelatedListService.IRelatedRow): React.ReactNode => {
        const text: string = row.values[column.name];
        // Az első oszlop a kapcsolódó elem megtekintő formjára mutat.
        return index === 0 && data ? (
          <Link href={itemUrl(data.displayFormUrl, row.id)} target="_blank" rel="noopener noreferrer">
            {text || `#${row.id}`}
          </Link>
        ) : column.type === 'Note' ? (
          <span className={classes.note}>{text}</span>
        ) : (
          text
        );
      }
    }));
    if (taskMode) {
      // Kitöltöm: a felhasználóhoz rendelt, megnyitható soroknál; Megtekintem: a többinél, ha a megtekintés be van kapcsolva;
      // Delegálom: minden sornál, a delegálás csoportjának tagjai számára.
      // Csak ikon; a felirat a buborékban (és az akadálymentes névben) jelenik meg. Az allowDisabledFocus miatt a
      // letiltott gomb is kap egéreseményt, így a buborék akkor is látszik.
      const rowButton = (label: string, iconName: string, disabled: boolean | undefined, onClick: () => void): JSX.Element => (
        <TooltipHost key={iconName} content={label}>
          <IconButton
            iconProps={{ iconName }}
            ariaLabel={label}
            disabled={disabled}
            allowDisabledFocus
            styles={ROW_BUTTON_STYLES}
            onClick={onClick}
          />
        </TooltipHost>
      );
      const width: number = delegateMode ? 62 : 32;
      result.unshift({
        key: ACTION_COLUMN,
        name: '',
        minWidth: width,
        maxWidth: width,
        onRender: (row: RelatedListService.IRelatedRow): React.ReactNode => (
          <div className={classes.rowButtons}>
            {openable.indexOf(row.id) !== -1
              ? rowButton(strings.TaskOpen, 'TaskManager', !canOpen, () => setOpenTask({ id: row.id, readOnly: false }))
              : viewMode
                ? rowButton(strings.TaskView, 'View', props.designing, () => setOpenTask({ id: row.id, readOnly: true }))
                : undefined}
            {delegateMode &&
              delegation &&
              // Csak a beállított állapotú feladatoknál (az állapot mezőt a lekérdezés ezért is lekéri).
              isDelegationAllowedForStatus(delegation, row.values[delegation.statusField]) &&
              rowButton(strings.TaskDelegate, 'PeopleRepeat', !canOpen, () => setDelegateTask(row.id))}
          </div>
        )
      });
    }
    return result;
  }, [data, taskMode, viewMode, delegateMode, delegation, openable, canOpen, props.designing]);

  if (!complete) {
    return props.designing ? <div className={classes.hint}>{strings.RelatedIncomplete}</div> : <></>;
  }
  if (itemId === undefined) {
    return <div className={classes.placeholder}>{strings.RelatedNeedsItem}</div>;
  }

  return (
    <div>
      <div className={classes.toolbar}>
        {config.showNewButton && data && (
          <DefaultButton
            iconProps={{ iconName: 'Add' }}
            text={strings.RelatedNewItem}
            href={data.newFormUrl}
            target="_blank"
            rel="noopener noreferrer"
          />
        )}
        <span className={classes.spacer} />
        {loading && <Spinner size={SpinnerSize.small} />}
        <IconButton
          iconProps={{ iconName: 'Refresh' }}
          title={strings.RelatedRefresh}
          ariaLabel={strings.RelatedRefresh}
          disabled={loading}
          onClick={() => setReloadCount(reloadCount + 1)}
        />
      </div>
      {error && <MessageBar messageBarType={MessageBarType.warning}>{error}</MessageBar>}
      {data && data.rows.length > 0 && (
        <div className={classes.table}>
          <DetailsList
            compact
            items={data.rows}
            columns={columns}
            getKey={(row: RelatedListService.IRelatedRow) => String(row.id)}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
          />
        </div>
      )}
      {data && data.rows.length === 0 && !loading && <div className={classes.hint}>{strings.RelatedEmpty}</div>}
      {data?.hasMore && <div className={classes.hint}>{format(strings.RelatedMore, getRowLimit(config))}</div>}
      {openTask !== undefined && config.task && (
        <React.Suspense fallback={<Spinner size={SpinnerSize.small} />}>
          <TaskDialog
            listId={config.listId}
            taskId={openTask.id}
            task={config.task}
            readOnly={openTask.readOnly}
            onDismiss={() => setOpenTask(undefined)}
            onCompleted={() => setReloadCount((count) => count + 1)}
          />
        </React.Suspense>
      )}
      {delegateTask !== undefined && config.task && delegation && (
        <React.Suspense fallback={<Spinner size={SpinnerSize.small} />}>
          <DelegateDialog
            listId={config.listId}
            taskId={delegateTask}
            task={config.task}
            delegation={delegation}
            onDismiss={() => setDelegateTask(undefined)}
            onCompleted={() => setReloadCount((count) => count + 1)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
