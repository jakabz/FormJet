// Admin-e a felhasználó (site admin vagy Manage Web).
// Ez csak a tervező kapcsolót rejti; a valódi védelem a FormConfigurations lista jogosultsága.

import { PermissionKind } from '@pnp/sp/security';
import { getSP } from './sp';

export async function isAdmin(): Promise<boolean> {
  try {
    const web = getSP().web;
    const user = (await web.currentUser.select('IsSiteAdmin')()) as { IsSiteAdmin?: boolean };
    if (user.IsSiteAdmin) {
      return true;
    }
    return await web.currentUserHasPermissions(PermissionKind.ManageWeb);
  } catch {
    return false;
  }
}

// Szerkesztheti-e a felhasználó az elemet (az elem saját jogosultsága szerint is).
// Csak a Szerkesztés gomb megjelenítéséről dönt; a mentést a SharePoint ellenőrzi.
export async function canEditItem(listId: string, itemId: number): Promise<boolean> {
  try {
    return await getSP().web.lists.getById(listId).items.getById(itemId).currentUserHasPermissions(PermissionKind.EditListItems);
  } catch {
    return false;
  }
}
