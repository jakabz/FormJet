// A beállító webpart felülete: a konfigurációs lista állapota, és a FormJet be- vagy kikapcsolása listánként.

import * as React from 'react';
import { DefaultButton } from '@fluentui/react/lib/Button';
import { Link } from '@fluentui/react/lib/Link';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import * as ConfigService from '../services/ConfigService';
import * as PermissionService from '../services/PermissionService';
import * as SetupService from '../services/SetupService';

const classes = mergeStyleSets({
  root: { padding: '8px 0' },
  title: { margin: '0 0 4px', fontSize: 20, fontWeight: 600 },
  intro: { margin: '0 0 16px', color: '#605e5c' },
  section: { margin: '0 0 24px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 8px' },
  sectionTitle: { margin: 0, fontSize: 16, fontWeight: 600 },
  line: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '6px 0' },
  hint: { fontSize: 12, color: '#605e5c' },
  messages: { display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 16px' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    selectors: {
      'th, td': { padding: '8px 12px 8px 0', textAlign: 'left', verticalAlign: 'middle', borderBottom: '1px solid #edebe9' },
      th: { fontSize: 12, fontWeight: 600, color: '#605e5c' }
    }
  }
});

function bindingText(binding: SetupService.FormBinding): string {
  switch (binding) {
    case 'formjet':
      return strings.SetupBindingFormJet;
    case 'other':
      return strings.SetupBindingOther;
    default:
      return strings.SetupBindingDefault;
  }
}

export const SetupPanel: React.FC = () => {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [isAdmin, setIsAdmin] = React.useState<boolean>(false);
  const [lists, setLists] = React.useState<SetupService.IListSetup[]>([]);
  const [configList, setConfigList] = React.useState<ConfigService.IConfigListStatus | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  // Az éppen futó művelet kulcsa; amíg fut, a vezérlők le vannak tiltva.
  const [busy, setBusy] = React.useState<string | undefined>();

  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const [admin, status, siteLists] = await Promise.all([
        PermissionService.isAdmin(),
        ConfigService.getListStatus(),
        SetupService.getLists()
      ]);
      setIsAdmin(admin);
      setConfigList(status);
      setLists(siteLists);
    } catch {
      setError(strings.SetupLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  /** Egy módosító művelet futtatása, utána az állapot újratöltése. */
  const run = async (key: string, action: () => Promise<void>): Promise<void> => {
    setBusy(key);
    setError(undefined);
    try {
      await action();
    } catch {
      setError(strings.SetupActionFailed);
    }
    try {
      const [status, siteLists] = await Promise.all([ConfigService.getListStatus(), SetupService.getLists()]);
      setConfigList(status);
      setLists(siteLists);
    } catch {
      setError(strings.SetupLoadFailed);
    } finally {
      setBusy(undefined);
    }
  };

  const disabled: boolean = !isAdmin || busy !== undefined;

  if (loading) {
    return (
      <div className={classes.root}>
        <Spinner size={SpinnerSize.large} label={strings.Loading} />
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <h2 className={classes.title}>{strings.SetupTitle}</h2>
      <p className={classes.intro}>{strings.SetupIntro}</p>

      <div className={classes.messages}>
        {!isAdmin && <MessageBar messageBarType={MessageBarType.warning}>{strings.SetupNotAdmin}</MessageBar>}
        {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
      </div>

      <div className={classes.section}>
        <div className={classes.sectionHeader}>
          <h3 className={classes.sectionTitle}>{strings.SetupConfigList}</h3>
        </div>
        <div className={classes.hint}>{format(strings.SetupConfigListHint, ConfigService.CONFIG_LIST_TITLE)}</div>
        {configList?.exists ? (
          <>
            <div className={classes.line}>
              <span>{strings.SetupConfigExists}</span>
              {configList.url && (
                <Link href={configList.url} target="_blank" rel="noopener noreferrer">
                  {ConfigService.CONFIG_LIST_TITLE}
                </Link>
              )}
            </div>
            {/* Ha az öröklés állapota nem állapítható meg, nem állítunk róla semmit, de a gomb elérhető marad. */}
            <div className={classes.line}>
              {configList.hasUniquePermissions !== undefined && (
                <span>{configList.hasUniquePermissions ? strings.SetupPermUnique : strings.SetupPermInherited}</span>
              )}
              {!configList.hasUniquePermissions && (
                <DefaultButton
                  text={strings.SetupPermRestrict}
                  disabled={disabled}
                  onClick={() => {
                    // Jogosultságot módosít, ezért megerősítést kérünk.
                    if (window.confirm(strings.SetupPermConfirm)) {
                      run('permissions', ConfigService.restrictListToReadOnly).catch(() => undefined);
                    }
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className={classes.line}>
            <span>{strings.SetupConfigMissing}</span>
            <DefaultButton
              text={strings.SetupConfigCreate}
              disabled={disabled}
              onClick={() => run('create', ConfigService.ensureList).catch(() => undefined)}
            />
          </div>
        )}
      </div>

      <div className={classes.section}>
        <div className={classes.sectionHeader}>
          <h3 className={classes.sectionTitle}>{strings.SetupLists}</h3>
          <DefaultButton
            iconProps={{ iconName: 'Refresh' }}
            text={strings.SetupRefresh}
            disabled={busy !== undefined}
            onClick={() => load().catch(() => undefined)}
          />
        </div>
        {lists.length === 0 ? (
          <div className={classes.hint}>{strings.SetupNoLists}</div>
        ) : (
          <table className={classes.table}>
            <thead>
              <tr>
                <th>{strings.SetupColumnList}</th>
                <th>{strings.SetupColumnContentType}</th>
                <th>{strings.SetupColumnForm}</th>
                <th>{strings.SetupBindingFormJet}</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) =>
                list.contentTypes.map((contentType, index) => {
                  const key: string = `${list.id}|${contentType.id}`;
                  return (
                    <tr key={key}>
                      <td>
                        {index === 0 &&
                          (list.url ? (
                            <Link href={list.url} target="_blank" rel="noopener noreferrer">
                              {list.title}
                            </Link>
                          ) : (
                            list.title
                          ))}
                      </td>
                      <td>{contentType.name}</td>
                      <td>{bindingText(contentType.binding)}</td>
                      <td>
                        <Toggle
                          ariaLabel={format(strings.SetupToggle, list.title, contentType.name)}
                          checked={contentType.binding === 'formjet'}
                          disabled={disabled}
                          styles={{ root: { marginBottom: 0 } }}
                          onChange={(_, checked) =>
                            run(key, () => SetupService.setBinding(list.id, contentType.id, !!checked)).catch(() => undefined)
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
