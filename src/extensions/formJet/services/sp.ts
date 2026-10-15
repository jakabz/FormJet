// A PnPjs példány és az SPFx kontextus. Az onInit-ben getSP(context), utána bárhol getSP().

import { FormCustomizerContext } from '@microsoft/sp-listview-extensibility';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { spfi, SPFI, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/fields';
import '@pnp/sp/content-types';
import '@pnp/sp/security';
import '@pnp/sp/site-users/web';
import '@pnp/sp/site-groups/web';
import '@pnp/sp/views';

/** Az űrlap (Form Customizer) vagy a beállító webpart kontextusa. */
export type SpfxContext = FormCustomizerContext | WebPartContext;

let sp: SPFI | undefined;
let spfxContext: SpfxContext | undefined;

export function getSP(context?: SpfxContext): SPFI {
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

/** A webhely teljes címe, záró perjel nélkül. */
export function getWebUrl(): string {
  if (!spfxContext) {
    throw new Error('The SPFx context is not initialized: call getSP(context) in onInit.');
  }
  return spfxContext.pageContext.web.absoluteUrl.replace(/\/$/, '');
}

/** A webhely kiszolgálójának címe, pl. `https://contoso.sharepoint.com`. */
export function getWebOrigin(): string {
  const url: string = spfxContext?.pageContext.web.absoluteUrl ?? window.location.href;
  const match: RegExpMatchArray | null = url.match(/^https?:\/\/[^/]+/i);
  return match ? match[0] : '';
}

/** A promise eredménye, vagy hiba a megadott üzenettel, ha `ms` ezredmásodpercen belül nem fejeződik be. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer: number = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** A PnPjs HttpRequestError HTTP státusza, ha a hiba HTTP válaszból származik. */
export function getHttpStatus(error: unknown): number | undefined {
  const status: unknown = (error as { status?: unknown } | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}
