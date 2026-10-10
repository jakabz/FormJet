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
