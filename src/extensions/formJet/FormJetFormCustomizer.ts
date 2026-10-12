import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { FormDisplayMode } from '@microsoft/sp-core-library';
import { BaseFormCustomizer } from '@microsoft/sp-listview-extensibility';

import * as strings from 'FormJetFormCustomizerStrings';

import { FormHost, IFormHostProps } from './components/FormHost';
import { setEngineStrings } from './engine/EngineStrings';
import { FormMode } from './models/IFormConfig';
import { getSP } from './services/sp';

// A customizer nem használ ClientSideComponentProperties értéket.
export interface IFormJetFormCustomizerProperties {}

function toFormMode(displayMode: FormDisplayMode): FormMode {
  switch (displayMode) {
    case FormDisplayMode.New:
      return 'new';
    case FormDisplayMode.Edit:
      return 'edit';
    default:
      return 'display';
  }
}

export default class FormJetFormCustomizer extends BaseFormCustomizer<IFormJetFormCustomizerProperties> {
  public onInit(): Promise<void> {
    getSP(this.context);
    setEngineStrings(strings.Engine);
    return Promise.resolve();
  }

  public render(): void {
    const list = this.context.list;
    const cultureInfo = this.context.pageContext.cultureInfo;
    const user = this.context.pageContext.user;
    const props: IFormHostProps = {
      mode: toFormMode(this.displayMode),
      listId: list.guid.toString(),
      listTitle: list.title,
      listUrl: list.serverRelativeUrl,
      // Új elem a megnyitott mappába kerül; mappa nélkül a lista gyökerébe.
      folderPath: this.context.folderInfo?.folderPath || list.serverRelativeUrl,
      itemId: this.context.itemId,
      contentTypeId: this.context.contentType?.id,
      cultureName: cultureInfo.currentCultureName,
      uiCultureName: cultureInfo.currentUICultureName,
      currentUser: {
        loginName: user.loginName,
        displayName: user.displayName,
        email: user.email,
        isGuest: user.isExternalGuestUser
      },
      onSaved: this._onSaved,
      onClosed: this._onClosed
    };

    ReactDOM.render(React.createElement(FormHost, props), this.domElement);
  }

  public onDispose(): void {
    ReactDOM.unmountComponentAtNode(this.domElement);
    super.onDispose();
  }

  private _onSaved = (): void => {
    this.formSaved();
  };

  private _onClosed = (): void => {
    this.formClosed();
  };
}
