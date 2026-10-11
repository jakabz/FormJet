// A PnPjs példány és az SPFx kontextus. Az onInit-ben getSP(context), utána bárhol getSP().

import { FormCustomizerContext } from '@microsoft/sp-listview-extensibility';
import { spfi, SPFI, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/fields';
import '@pnp/sp/content-types';
import '@pnp/sp/security';
import '@pnp/sp/site-users/web';

let sp: SPFI | undefined;
let spfxContext: FormCustomizerContext | undefined;

export function getSP(context?: FormCustomizerContext): SPFI {
  if (context) {
    spfxContext = context;
    sp = spfi().using(SPFx(context));
  }
  if (!sp) {
    throw new Error('PnPjs is not initialized: call getSP(context) in onInit.');
  }
  return sp;
}

/** A felhasználó hozzáférési tokenje egy Microsoft 365 erőforráshoz (nem SharePoint hívásokhoz). */
export async function getAadToken(resource: string): Promise<string> {
  if (!spfxContext) {
    throw new Error('The SPFx context is not initialized: call getSP(context) in onInit.');
  }
  const provider = await spfxContext.aadTokenProviderFactory.getTokenProvider();
  return provider.getToken(resource);
}

/** A PnPjs HttpRequestError HTTP státusza, ha a hiba HTTP válaszból származik. */
export function getHttpStatus(error: unknown): number | undefined {
  const status: unknown = (error as { status?: unknown } | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}
