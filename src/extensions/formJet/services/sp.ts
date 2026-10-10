// A PnPjs példány. Az onInit-ben getSP(context), utána bárhol getSP().

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

export function getSP(context?: FormCustomizerContext): SPFI {
  if (context) {
    sp = spfi().using(SPFx(context));
  }
  if (!sp) {
    throw new Error('A PnPjs nincs inicializálva: az onInit-ben hívd meg a getSP(context)-et.');
  }
  return sp;
}

/** A PnPjs HttpRequestError HTTP státusza, ha a hiba HTTP válaszból származik. */
export function getHttpStatus(error: unknown): number | undefined {
  const status: unknown = (error as { status?: unknown } | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}
