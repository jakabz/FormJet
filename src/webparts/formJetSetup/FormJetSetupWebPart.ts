// FormJet beállító webpart: a webhely listáin kapcsolja be vagy ki a FormJet űrlapot,
// és létrehozza a konfigurációs listát. Csak azt a webhelyet kezeli, ahol ki van téve.

import * as React from 'react';
import * as ReactDom from 'react-dom';

import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import { SetupPanel } from '../../extensions/formJet/components/SetupPanel';
import { getSP } from '../../extensions/formJet/services/sp';

// A webpartnak nincs beállítható tulajdonsága.
export interface IFormJetSetupWebPartProps {}

export default class FormJetSetupWebPart extends BaseClientSideWebPart<IFormJetSetupWebPartProps> {
  protected onInit(): Promise<void> {
    getSP(this.context);
    return Promise.resolve();
  }

  public render(): void {
    ReactDom.render(React.createElement(SetupPanel), this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}
