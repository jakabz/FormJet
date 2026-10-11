// A FormJet bekapcsolása a webhely listáin: a lista tartalomtípusának űrlapjait a FormJet összetevőre állítja.
// Ugyanazt végzi, mint a scripts/Provision-FormJet.ps1, csak a böngészőből.

import { CONFIG_LIST_TITLE } from './ConfigService';
import { getSP } from './sp';

/** A FormJet Form Customizer összetevő azonosítója (FormJetFormCustomizer.manifest.json `id`). */
export const FORMJET_COMPONENT_ID: string = '89262798-3b9c-4299-9d5b-754a7e8ac6d8';

const FOLDER_CONTENT_TYPE_PREFIX: string = '0x0120';
const NEW_KEY: string = 'NewFormClientSideComponentId';
const EDIT_KEY: string = 'EditFormClientSideComponentId';
// A megtekintő űrlap tulajdonságának neve a REST felületen kétféle lehet; azt használjuk, amelyik a válaszban szerepel.
const DISPLAY_KEYS: string[] = ['DisplayFormClientSideComponentId', 'DispFormClientSideComponentId'];

/** Melyik űrlap nyílik meg a tartalomtípus elemeinél. */
export type FormBinding = 'formjet' | 'default' | 'other';

export interface IContentTypeSetup {
  id: string;
  name: string;
  binding: FormBinding;
}

export interface IListSetup {
  id: string;
  title: string;
  /** A lista szerverrelatív címe. */
  url: string;
  contentTypes: IContentTypeSetup[];
}

let displayKey: string = DISPLAY_KEYS[0];

function componentId(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[{}]/g, '').trim().toLowerCase() : '';
}

function bindingOf(contentType: Record<string, unknown>): FormBinding {
  const ids: string[] = [contentType[NEW_KEY], contentType[EDIT_KEY], contentType[displayKey]].map(componentId);
  if (ids.every((id) => id === FORMJET_COMPONENT_ID)) {
    return 'formjet';
  }
  return ids.every((id) => id === '') ? 'default' : 'other';
}

/** A webhely listái (dokumentumtárak és rejtett listák nélkül) a tartalomtípusaik űrlapbeállításával. */
export async function getLists(): Promise<IListSetup[]> {
  const lists = (await getSP()
    .web.lists.filter('Hidden eq false and BaseType eq 0')
    .select('Id', 'Title', 'RootFolder/ServerRelativeUrl', 'ContentTypes')
    .expand('RootFolder', 'ContentTypes')
    .orderBy('Title')()) as Array<{
    Id: string;
    Title: string;
    RootFolder?: { ServerRelativeUrl?: string };
    ContentTypes?: Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };
  }>;

  return lists
    .filter((list) => list.Title !== CONFIG_LIST_TITLE)
    .map((list) => {
      const raw: Array<Record<string, unknown>> = Array.isArray(list.ContentTypes)
        ? list.ContentTypes
        : list.ContentTypes?.results ?? [];
      const contentTypes: IContentTypeSetup[] = raw
        .map((contentType) => {
          const present: string | undefined = DISPLAY_KEYS.filter((key) => key in contentType)[0];
          if (present) {
            displayKey = present;
          }
          const id: string = String(contentType.StringId ?? (contentType.Id as { StringValue?: string } | undefined)?.StringValue ?? '');
          return { id, name: String(contentType.Name ?? id), binding: bindingOf(contentType) };
        })
        .filter((contentType) => contentType.id !== '' && contentType.id.indexOf(FOLDER_CONTENT_TYPE_PREFIX) !== 0);
      return { id: list.Id, title: list.Title, url: list.RootFolder?.ServerRelativeUrl ?? '', contentTypes };
    });
}

/** A FormJet be- vagy kikapcsolása a lista egy tartalomtípusán (mindhárom űrlapra egyszerre). */
export async function setBinding(listId: string, contentTypeId: string, enabled: boolean): Promise<void> {
  const value: string = enabled ? FORMJET_COMPONENT_ID : '';
  await getSP()
    .web.lists.getById(listId)
    .contentTypes.getById(contentTypeId)
    .update({ [NEW_KEY]: value, [EDIT_KEY]: value, [displayKey]: value });
}
