// Kapcsolódó elemek szekció: egy másik lista párosított elemei csak olvasható táblázatban.

import * as React from 'react';
import { DefaultButton, IconButton } from '@fluentui/react/lib/Button';
import { DetailsList, DetailsListLayoutMode, IColumn, SelectionMode } from '@fluentui/react/lib/DetailsList';
import { Link } from '@fluentui/react/lib/Link';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { getRowLimit, ID_FIELD, isRelatedComplete } from '../engine/RelatedList';
import { IRelatedListConfig } from '../models/IFormConfig';
import * as RelatedListService from '../services/RelatedListService';
import { FormContext } from './FormContext';

const classes = mergeStyleSets({
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  spacer: { flex: 1 },
  hint: { fontSize: 12, color: '#605e5c', padding: '6px 0' },
  table: { overflowX: 'auto' }
});

export interface IRelatedItemsProps {
  config: IRelatedListConfig;
  /** Tervező előnézet: a hiányos beállításra is figyelmeztet. */
  designing?: boolean;
}

function itemUrl(displayFormUrl: string, id: number): string {
  return `${displayFormUrl}${displayFormUrl.indexOf('?') === -1 ? '?' : '&'}ID=${id}`;
}

export const RelatedItems: React.FC<IRelatedItemsProps> = (props) => {
  const { config } = props;
  const { itemId, sourceValues } = React.useContext(FormContext);
  const [data, setData] = React.useState<RelatedListService.IRelatedData | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState<boolean>(false);
  const [reloadCount, setReloadCount] = React.useState<number>(0);

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
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(undefined);
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

  const columns: IColumn[] = React.useMemo(
    () =>
      (data?.columns ?? []).map((column, index) => ({
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
          ) : (
            text
          );
        }
      })),
    [data]
  );

  if (!complete) {
    return props.designing ? <div className={classes.hint}>{strings.RelatedIncomplete}</div> : <></>;
  }
  if (itemId === undefined) {
    return props.designing ? <div className={classes.hint}>{strings.RelatedNeedsItem}</div> : <></>;
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
    </div>
  );
};
