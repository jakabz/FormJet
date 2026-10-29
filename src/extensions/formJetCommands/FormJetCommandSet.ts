// FormJet menüpontok a lista helyi menüjében (ListView Command Set).
// A menüpontokat listánként a FormConfigurations lista „listcommands” bejegyzése adja (a beállító webpartban szerkeszthető);
// a manifest 10 helyet (COMMAND_1 … COMMAND_10) ad, ezek kapnak futás közben feliratot, ikont és láthatóságot.
// Egy kijelölt elemnél látszanak, a feltételük szerint. Futtatás: megerősítés → lépések sorban → visszajelzés → lista frissítése.

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  BaseListViewCommandSet,
  Command,
  IListViewCommandSetExecuteEventParameters,
  RowAccessor
} from '@microsoft/sp-listview-extensibility';

import * as strings from 'FormJetFormCustomizerStrings';

import { CommandDialog } from '../formJet/components/CommandDialog';
import { setEngineStrings } from '../formJet/engine/EngineStrings';
import { collectCommandGroupIds, isCommandVisible } from '../formJet/engine/ListCommands';
import { ICurrentUser } from '../formJet/engine/UserValue';
import { FormValues } from '../formJet/models/IFieldSchema';
import { IListCommand, IListCommandsConfig, LIST_COMMAND_SLOTS } from '../formJet/models/IListCommands';
import * as GroupService from '../formJet/services/GroupService';
import * as ListCommandService from '../formJet/services/ListCommandService';
import { getSP } from '../formJet/services/sp';
import { getCommandIconUrl } from './CommandIcon';

// A Command Set nem használ ClientSideComponentProperties értéket.
export interface IFormJetCommandSetProperties {}

interface IItemState {
  values: FormValues;
  authorId?: number;
}

function slotId(index: number): string {
  return `COMMAND_${index + 1}`;
}

export default class FormJetCommandSet extends BaseListViewCommandSet<IFormJetCommandSetProperties> {
  private _config: IListCommandsConfig | undefined;
  private _memberGroupIds: number[] = [];
  /** A kijelölt elemek értékei a feltételekhez, azonosító szerint (betöltés alatt `loading`). */
  private _items: Record<number, IItemState | 'loading' | 'failed'> = {};
  /** Az elkészült ikonképek ikonnév szerint. */
  private _icons: Map<string, string> = new Map();
  /** A készülő ikonképek; a sikertelen a következő frissítéskor (kijelölés-változáskor) újra próbálkozik. */
  private _iconsLoading: Set<string> = new Set();

  public async onInit(): Promise<void> {
    getSP(this.context);
    setEngineStrings(strings.Engine);
    this._update();
    this.context.listView.listViewStateChangedEvent.add(this, this._update);

    const listId: string | undefined = this._listId();
    if (!listId) {
      return;
    }
    try {
      const loaded = await ListCommandService.load(listId);
      this._config = loaded.config;
      const groupIds: number[] = this._config ? collectCommandGroupIds(this._config) : [];
      if (groupIds.length > 0) {
        const membership = await GroupService.getMembership(groupIds, !!this.context.pageContext.user.isExternalGuestUser);
        this._memberGroupIds = membership.memberOf;
      }
    } catch {
      // Konfiguráció nélkül a menüpontok rejtve maradnak.
      this._config = undefined;
    }
    this._update();
  }

  public onExecute(event: IListViewCommandSetExecuteEventParameters): void {
    const index: number = Number(event.itemId.replace('COMMAND_', '')) - 1;
    const command: IListCommand | undefined = this._config?.commands[index];
    const listId: string | undefined = this._listId();
    const itemId: number | undefined = this._itemId(event.selectedRows);
    if (!command || !listId || itemId === undefined) {
      return;
    }
    const host: HTMLDivElement = document.createElement('div');
    document.body.appendChild(host);
    const close = (changed: boolean): void => {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
      if (changed) {
        // A lista nézet frissítésére nincs nyilvános felület, ezért a lapot töltjük újra.
        window.location.reload();
      }
    };
    ReactDOM.render(
      React.createElement(CommandDialog, {
        command,
        onRun: () => ListCommandService.run(listId, itemId, command, { culture: this._culture(), currentUser: this._currentUser() }),
        onClose: close
      }),
      host
    );
  }

  private _listId(): string | undefined {
    return this.context.pageContext.list?.id.toString();
  }

  private _culture(): string {
    return this.context.pageContext.cultureInfo.currentCultureName;
  }

  private _currentUserId(): number | undefined {
    const legacyUserId: unknown = (this.context.pageContext.legacyPageContext as { userId?: unknown } | undefined)?.userId;
    return typeof legacyUserId === 'number' ? legacyUserId : undefined;
  }

  private _currentUser(): ICurrentUser {
    const user = this.context.pageContext.user;
    return {
      loginName: user.loginName,
      displayName: user.displayName,
      email: user.email,
      isGuest: user.isExternalGuestUser,
      id: this._currentUserId()
    };
  }

  /** A kijelölt elem azonosítója, ha pontosan egy elem van kijelölve. */
  private _itemId(rows: ReadonlyArray<RowAccessor> | undefined): number | undefined {
    if (!rows || rows.length !== 1) {
      return undefined;
    }
    const id: number = Number(rows[0].getValueByName('ID'));
    return isNaN(id) ? undefined : id;
  }

  /** A menüpont-helyek feliratának és láthatóságának frissítése a kijelölés és a konfiguráció szerint. */
  private _update(): void {
    const itemId: number | undefined = this._itemId(this.context.listView.selectedRows);
    const commands: IListCommand[] = this._config?.commands ?? [];
    let needsItem: boolean = false;
    for (let i: number = 0; i < LIST_COMMAND_SLOTS; i++) {
      const slot: Command | undefined = this.tryGetCommand(slotId(i));
      if (!slot) {
        continue;
      }
      const command: IListCommand | undefined = commands[i];
      if (!command || itemId === undefined) {
        slot.visible = false;
        continue;
      }
      slot.title = command.title;
      slot.iconImageUrl = this._iconUrl(command.icon);
      if (!command.visibleWhen) {
        slot.visible = true;
        continue;
      }
      // Feltételes menüpont: a kijelölt elem értékei kellenek; amíg töltődnek, a menüpont rejtett.
      const state = this._items[itemId];
      if (state === undefined || state === 'loading' || state === 'failed') {
        slot.visible = false;
        needsItem = needsItem || state === undefined;
        continue;
      }
      slot.visible = isCommandVisible(command, state.values, this._memberGroupIds, state.authorId !== undefined && state.authorId === this._currentUserId());
    }
    this.raiseOnChange();
    if (needsItem && itemId !== undefined) {
      this._loadItem(itemId);
    }
  }

  /** Az ikon képe; az első kéréskor elindítja az elkészítését, és utána frissíti a menüpontokat. */
  private _iconUrl(icon: string | undefined): string | undefined {
    if (!icon) {
      return undefined;
    }
    if (!this._icons.has(icon) && !this._iconsLoading.has(icon)) {
      this._iconsLoading.add(icon);
      getCommandIconUrl(icon)
        .then((url) => {
          this._iconsLoading.delete(icon);
          if (url) {
            this._icons.set(icon, url);
            this._update();
          }
        })
        .catch(() => this._iconsLoading.delete(icon));
    }
    return this._icons.get(icon);
  }

  private _loadItem(itemId: number): void {
    const listId: string | undefined = this._listId();
    if (!listId) {
      return;
    }
    this._items[itemId] = 'loading';
    ListCommandService.loadItemForVisibility(listId, itemId)
      .then((item) => {
        this._items[itemId] = item;
      })
      .catch(() => {
        this._items[itemId] = 'failed';
      })
      .then(() => this._update())
      .catch(() => undefined);
  }
}
