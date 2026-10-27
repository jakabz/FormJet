// Konfiguráció olvasása / mentése a FormConfigurations listában, ETag-gel.

import * as strings from 'FormJetFormCustomizerStrings';

import { format } from '../engine/EngineStrings';
import { parseConfig } from '../engine/LayoutResolver';
import { IFormConfig } from '../models/IFormConfig';
import { getHttpStatus, getSP } from './sp';

export const CONFIG_LIST_TITLE: string = 'FormConfigurations';

const FIELD_LIST_ID: string = 'FormJetListId';
const FIELD_CONTENT_TYPE_ID: string = 'FormJetContentTypeId';
const FIELD_CONFIG: string = 'FormJetConfig';

/** Más közben mentette a konfigurációt (HTTP 412). */
export class ConfigConflictError extends Error {
  public constructor() {
    super('The configuration was modified by someone else.');
    Object.setPrototypeOf(this, ConfigConflictError.prototype);
  }
}

/** A felhasználónak nincs írási joga a FormConfigurations listán (HTTP 403). */
export class ConfigAccessDeniedError extends Error {
  public constructor() {
    super('Access denied to the configuration list.');
    Object.setPrototypeOf(this, ConfigAccessDeniedError.prototype);
  }
}

export interface IConfigRef {
  itemId?: number;
  etag?: string;
}

export interface IConfigLoadResult extends IConfigRef {
  /** Hiányzik, ha nincs mentett konfiguráció, vagy az hibás. */
  config?: IFormConfig;
  /** Adminnak szóló figyelmeztetés: a lista nem érhető el, vagy a mentett JSON hibás. */
  warning?: string;
}

interface IConfigItem {
  Id: number;
  FormJetConfig?: string;
  'odata.etag'?: string;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Egy bejegyzés a konfigurációs listában: a nyers JSON és a hivatkozás (azonosító, ETag). */
export interface IConfigEntry extends IConfigRef {
  /** Hiányzik, ha nincs ilyen bejegyzés. */
  raw?: string;
  /** A konfigurációs lista nem érhető el. */
  warning?: string;
}

/**
 * Bejegyzés olvasása a lista és a kulcs szerint. A kulcs az űrlapnál a tartalomtípus azonosítója, a lista menüpontjainál
 * a LIST_COMMANDS_KEY.
 */
export async function loadEntry(listId: string, key: string): Promise<IConfigEntry> {
  let items: IConfigItem[];
  try {
    items = (await getSP()
      .web.lists.getByTitle(CONFIG_LIST_TITLE)
      .items.select('Id', FIELD_CONFIG)
      .filter(`${FIELD_LIST_ID} eq ${quote(listId)} and ${FIELD_CONTENT_TYPE_ID} eq ${quote(key)}`)
      .top(1)()) as IConfigItem[];
  } catch {
    return { warning: format(strings.ConfigListUnavailable, CONFIG_LIST_TITLE) };
  }
  const item: IConfigItem | undefined = items[0];
  return item ? { itemId: item.Id, etag: item['odata.etag'], raw: item.FormJetConfig ?? '' } : {};
}

export async function load(listId: string, contentTypeId: string): Promise<IConfigLoadResult> {
  const entry: IConfigEntry = await loadEntry(listId, contentTypeId);
  if (entry.warning) {
    return { warning: entry.warning };
  }
  if (entry.raw === undefined) {
    return {};
  }
  const ref: IConfigRef = { itemId: entry.itemId, etag: entry.etag };
  const parsed = parseConfig(entry.raw);
  if (!parsed.config) {
    return {
      ...ref,
      warning: format(strings.ConfigInvalid, parsed.error ?? '')
    };
  }
  return { ...ref, config: parsed.config };
}

export interface IConfigListStatus {
  exists: boolean;
  /** A lista szerverrelatív címe. */
  url?: string;
  /** Saját (nem a webhelytől örökölt) jogosultságai vannak-e. */
  hasUniquePermissions?: boolean;
}

// SP.RoleType: Guest = 1 (korlátozott hozzáférés), Reader = 2, Administrator = 5 (teljes hozzáférés).
const ROLE_TYPE_GUEST: number = 1;
const ROLE_TYPE_READER: 2 = 2;
const ROLE_TYPE_ADMINISTRATOR: number = 5;
const GENERIC_LIST_TEMPLATE: number = 100;

export async function getListStatus(): Promise<IConfigListStatus> {
  const list = getSP().web.lists.getByTitle(CONFIG_LIST_TITLE);
  let url: string | undefined;
  try {
    const info = (await list.select('Id', 'RootFolder/ServerRelativeUrl').expand('RootFolder')()) as {
      RootFolder?: { ServerRelativeUrl?: string };
    };
    url = info.RootFolder?.ServerRelativeUrl;
  } catch (e) {
    if (getHttpStatus(e) === 404) {
      return { exists: false };
    }
    throw e;
  }

  // A jogosultság öröklését külön, önmagában kérdezzük le: más tulajdonságokkal együtt kérve a SharePoint
  // nem adta vissza megbízhatóan. Ha nem sikerül megállapítani, az állapot ismeretlen marad.
  let hasUniquePermissions: boolean | undefined;
  try {
    const security = (await list.select('HasUniqueRoleAssignments')()) as { HasUniqueRoleAssignments?: boolean | string };
    const value: boolean | string | undefined = security.HasUniqueRoleAssignments;
    hasUniquePermissions = value === undefined ? undefined : value === true || value === 'true';
  } catch {
    hasUniquePermissions = undefined;
  }
  return { exists: true, url, hasUniquePermissions };
}

/** A konfigurációs lista létrehozása, ha még nincs. Listakezelési jog kell hozzá. */
export async function ensureList(): Promise<void> {
  if ((await getListStatus()).exists) {
    return;
  }
  const sp = getSP();
  await sp.web.lists.add(CONFIG_LIST_TITLE, '', GENERIC_LIST_TEMPLATE, false, { OnQuickLaunch: false });
  const list = sp.web.lists.getByTitle(CONFIG_LIST_TITLE);
  await list.fields.addText(FIELD_LIST_ID, { Indexed: true });
  await list.fields.addText(FIELD_CONTENT_TYPE_ID);
  await list.fields.addMultilineText(FIELD_CONFIG, { NumberOfLines: 20, RichText: false });
  try {
    await list.defaultView.fields.add(FIELD_LIST_ID);
    await list.defaultView.fields.add(FIELD_CONTENT_TYPE_ID);
  } catch {
    // A nézet oszlopai csak a kézi áttekintést segítik; hiányuk nem hiba.
  }
}

/**
 * A konfigurációs lista jogosultságának szűkítése: a lista saját jogosultságot kap (a webhelyét lemásolva), és
 * mindenki, akinek írási joga volt, csak olvasási jogot kap. Kivétel a teljes hozzáférés (tulajdonosok, webhelygazdák)
 * és a tulajdonosok csoportja; a csak korlátozott hozzáféréssel rendelkezők nem kapnak olvasási jogot.
 */
export async function restrictListToReadOnly(): Promise<void> {
  const sp = getSP();
  const list = sp.web.lists.getByTitle(CONFIG_LIST_TITLE);
  await list.breakRoleInheritance(true, false);
  const reader = (await sp.web.roleDefinitions.getByType(ROLE_TYPE_READER).select('Id')()) as { Id: number };
  let ownersId: number | undefined;
  try {
    ownersId = ((await sp.web.associatedOwnerGroup.select('Id')()) as { Id: number }).Id;
  } catch {
    // A webhelynek nincs tulajdonosi csoportja; a teljes hozzáférés így is megmarad.
  }

  const assignments = (await list.roleAssignments
    .expand('RoleDefinitionBindings')
    .select('PrincipalId', 'RoleDefinitionBindings/Id', 'RoleDefinitionBindings/RoleTypeKind')()) as Array<{
    PrincipalId: number;
    RoleDefinitionBindings?: Array<{ Id: number; RoleTypeKind: number }>;
  }>;
  for (const assignment of assignments) {
    const bindings: Array<{ Id: number; RoleTypeKind: number }> = assignment.RoleDefinitionBindings ?? [];
    if (assignment.PrincipalId === ownersId || bindings.some((role) => role.RoleTypeKind === ROLE_TYPE_ADMINISTRATOR)) {
      continue;
    }
    // Minden, ami nem olvasás és nem korlátozott hozzáférés (szerkesztés, közreműködés, egyéni szerepkör), lekerül.
    const toRemove = bindings.filter((role) => role.Id !== reader.Id && role.RoleTypeKind !== ROLE_TYPE_GUEST);
    if (toRemove.length === 0) {
      continue;
    }
    // Előbb az olvasás kerül fel, utána kerülnek le a többiek, hogy közben senki se maradjon jog nélkül.
    if (!bindings.some((role) => role.Id === reader.Id)) {
      await list.roleAssignments.add(assignment.PrincipalId, reader.Id);
    }
    for (const role of toRemove) {
      await list.roleAssignments.remove(assignment.PrincipalId, role.Id);
    }
  }
}

async function write(listId: string, key: string, title: string, json: string, ref: IConfigRef): Promise<IConfigRef> {
  const list = getSP().web.lists.getByTitle(CONFIG_LIST_TITLE);
  const payload: Record<string, string> = {
    Title: title,
    [FIELD_LIST_ID]: listId,
    [FIELD_CONTENT_TYPE_ID]: key,
    [FIELD_CONFIG]: json
  };
  let itemId: number | undefined = ref.itemId;
  if (itemId !== undefined) {
    await list.items.getById(itemId).update(payload, ref.etag ?? '*');
  } else {
    const added = (await list.items.add(payload)) as { Id: number };
    itemId = added.Id;
  }
  const fresh = (await list.items.getById(itemId).select('Id')()) as IConfigItem;
  return { itemId, etag: fresh['odata.etag'] };
}

/**
 * Mentés ETag-gel. 412 → ConfigConflictError, 403 → ConfigAccessDeniedError.
 * Ha a konfigurációs lista még nem létezik, létrehozza, és újra ment.
 */
export async function save(config: IFormConfig, ref: IConfigRef): Promise<IConfigRef> {
  return saveEntry(
    config.listId,
    config.contentTypeId,
    config.title || `${config.listId} / ${config.contentTypeId}`,
    JSON.stringify(config, undefined, 2),
    ref
  );
}

/** Tetszőleges kulcsú bejegyzés mentése ETag-gel (ugyanazokkal a hibákkal, mint a save). */
export async function saveEntry(listId: string, key: string, title: string, json: string, ref: IConfigRef): Promise<IConfigRef> {
  try {
    try {
      return await write(listId, key, title, json, ref);
    } catch (e) {
      // Első mentés olyan webhelyen, ahol a lista még nincs meg.
      if (ref.itemId === undefined && getHttpStatus(e) === 404 && !(await getListStatus()).exists) {
        await ensureList();
        return await write(listId, key, title, json, ref);
      }
      throw e;
    }
  } catch (e) {
    const status: number | undefined = getHttpStatus(e);
    if (status === 412) {
      throw new ConfigConflictError();
    }
    if (status === 403) {
      throw new ConfigAccessDeniedError();
    }
    throw e;
  }
}
