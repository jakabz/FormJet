// Személyek és csoportok keresése a SharePoint névkeresőjével (ugyanaz, amit a gyári személyválasztó használ).

import '@pnp/sp/profiles';

import { IUserEntry } from '../engine/UserValue';
import { getSP } from './sp';

// SP.Utilities.PrincipalType: User = 1, DistributionList = 2, SecurityGroup = 4, SharePointGroup = 8.
const PRINCIPAL_TYPE_USER: number = 1;
const PRINCIPAL_TYPE_ALL: number = 15;
// SP.Utilities.PrincipalSource.All
const PRINCIPAL_SOURCE_ALL: number = 15;
const MAX_SUGGESTIONS: number = 10;

export interface IPeopleSearchOptions {
  /** Csoportok is választhatók (a mező „Személyek és csoportok” beállítása). */
  allowGroups: boolean;
  /** Ha a mező egy SharePoint csoport tagjaira van szűkítve: a csoport azonosítója. */
  sharePointGroupId?: number;
}

export async function searchPeople(query: string, options: IPeopleSearchOptions): Promise<IUserEntry[]> {
  const text: string = query.trim();
  if (text === '') {
    return [];
  }
  const entities = await getSP().profiles.clientPeoplePickerSearchUser({
    QueryString: text,
    AllowEmailAddresses: true,
    AllowMultipleEntities: false,
    MaximumEntitySuggestions: MAX_SUGGESTIONS,
    PrincipalSource: PRINCIPAL_SOURCE_ALL,
    PrincipalType: options.allowGroups ? PRINCIPAL_TYPE_ALL : PRINCIPAL_TYPE_USER,
    SharePointGroupID: options.sharePointGroupId ?? 0
  });
  return entities
    .filter((entity) => !!entity.Key)
    .map((entity) => ({
      key: entity.Key,
      text: entity.DisplayText || entity.Key,
      secondaryText: entity.EntityData?.Email || entity.Description || undefined
    }));
}
