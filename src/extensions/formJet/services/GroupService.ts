// SharePoint csoportok: a webhely csoportjai (a tervezőhöz) és a bejelentkezett felhasználó tagsága
// (a csoporttagságra épülő feltételekhez).
// A tagság csak a form testreszabására való, nem jogosultsági ellenőrzés.

import { DirectoryClaim, isMemberByClaims, parseDirectoryClaim } from '../engine/ConditionContext';
import { getAadToken, getSP, withTimeout } from './sp';

const GRAPH_RESOURCE: string = 'https://graph.microsoft.com';
const GRAPH_MEMBER_OF_URL: string = `${GRAPH_RESOURCE}/v1.0/me/transitiveMemberOf?$select=id&$top=999`;
/** A Graph-lekérdezés (token + lapok) legfeljebb ennyi ideig tarthat; utána a közvetett tagság nem ellenőrizhető. */
const GRAPH_TIMEOUT_MS: number = 10000;

export interface ISiteGroup {
  id: number;
  title: string;
}

export interface IMembership {
  /** A vizsgált csoportok közül azok, amelyeknek a felhasználó tagja. */
  memberOf: number[];
  /**
   * Igaz, ha a közvetett (Entra vagy Microsoft 365 csoporton keresztüli) tagság nem volt eldönthető,
   * ezért egy ilyen csoportnál a felhasználó tévesen is számíthat nem tagnak.
   */
  incomplete: boolean;
}

/** A webhely SharePoint csoportjai név szerint rendezve. */
export async function getSiteGroups(): Promise<ISiteGroup[]> {
  const groups = (await getSP().web.siteGroups.select('Id', 'Title')()) as Array<{ Id: number; Title: string }>;
  return groups
    .map((group) => ({ id: group.Id, title: group.Title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** A felhasználó címtárbeli (Entra) csoportjainak azonosítói a közvetett tagságokkal együtt, a Microsoft Graphból. */
async function getDirectoryGroupIds(): Promise<string[]> {
  const token: string = await getAadToken(GRAPH_RESOURCE);
  const ids: string[] = [];
  let url: string | undefined = GRAPH_MEMBER_OF_URL;
  while (url) {
    const response: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Microsoft Graph: ${response.status}`);
    }
    const body = (await response.json()) as { value?: Array<{ id?: string }>; '@odata.nextLink'?: string };
    (body.value ?? []).forEach((item) => {
      if (item.id) {
        ids.push(item.id.toLowerCase());
      }
    });
    url = body['@odata.nextLink'];
  }
  return ids;
}

/**
 * A megadott SharePoint csoportok közül melyeknek tagja a bejelentkezett felhasználó.
 * Közvetlen tagság: a felhasználó saját csoportlistája. Közvetett tagság: a csoport tagjai között szereplő
 * „Mindenki” jellegű tagok és címtárbeli csoportok, az utóbbiak a Microsoft Graph alapján.
 */
export async function getMembership(groupIds: number[], isGuest: boolean): Promise<IMembership> {
  if (groupIds.length === 0) {
    return { memberOf: [], incomplete: false };
  }
  const web = getSP().web;
  const direct = (await web.currentUser.groups.select('Id')()) as Array<{ Id: number }>;
  const directIds: number[] = direct.map((group) => group.Id);
  const memberOf: number[] = groupIds.filter((id) => directIds.indexOf(id) !== -1);

  // A többi csoportnál a tagok között keresünk olyan címtárbeli tagot, amelyen keresztül a felhasználó tag lehet.
  const remaining: number[] = groupIds.filter((id) => directIds.indexOf(id) === -1);
  const claimsByGroup: DirectoryClaim[][] = await Promise.all(
    remaining.map(async (id) => {
      try {
        const users = (await web.siteGroups.getById(id).users.select('LoginName')()) as Array<{ LoginName?: string }>;
        const claims: DirectoryClaim[] = [];
        users.forEach((user) => {
          const claim: DirectoryClaim | undefined = parseDirectoryClaim(user.LoginName ?? '');
          if (claim) {
            claims.push(claim);
          }
        });
        return claims;
      } catch {
        // A csoport nem létezik, vagy a tagjait a felhasználó nem láthatja: közvetett tagság nem állapítható meg.
        return [];
      }
    })
  );

  let directoryGroupIds: string[] | undefined;
  let incomplete: boolean = false;
  if (claimsByGroup.some((claims) => claims.some((claim) => claim.kind === 'directoryGroup'))) {
    try {
      // A token kérése egyes környezetekben válasz nélkül maradhat; időkorláttal a form akkor is betölt.
      directoryGroupIds = await withTimeout(getDirectoryGroupIds(), GRAPH_TIMEOUT_MS, 'Microsoft Graph timeout');
    } catch {
      incomplete = true;
    }
  }
  remaining.forEach((id, index) => {
    if (isMemberByClaims(claimsByGroup[index], directoryGroupIds, isGuest)) {
      memberOf.push(id);
    }
  });
  return { memberOf, incomplete };
}
