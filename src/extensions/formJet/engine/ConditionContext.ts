// A feltételek környezeti változói: a form módja és a felhasználó SharePoint csoporttagsága.
// A felhasználó és az elem létrehozójának egyezése is ilyen változó (`[IsAuthor]`).
// A feltételekben mezőként hivatkozhatók (`[IsNewMode]`, `[Group:5]`), értékük igen / nem (`1` / `0`),
// így a meglévő operátorokkal vizsgálhatók és a mezőfeltételekkel szabadon keverhetők.
// A szögletes zárójel miatt a nevük nem ütközhet SharePoint mező belső nevével.
// Tiszta logika: nem importálhat services/-ből, components/-ből, @pnp/*-ból vagy @microsoft/*-ból.

import { FormValues } from '../models/IFieldSchema';
import { Condition, FormMode, IConditionalValue, IFormConfig } from '../models/IFormConfig';

/** A form módját jelző változók; közülük mindig pontosan egy igaz. */
export const MODE_VARIABLES: Record<FormMode, string> = {
  new: '[IsNewMode]',
  edit: '[IsEditMode]',
  display: '[IsDisplayMode]'
};

/** Igaz, ha a bejelentkezett felhasználó hozta létre az elemet (új elemnél mindig igaz). */
export const AUTHOR_VARIABLE: string = '[IsAuthor]';

const GROUP_VARIABLE: RegExp = /^\[Group:(\d+)\]$/;

const TRUE_VALUE: string = '1';
const FALSE_VALUE: string = '0';

/** A SharePoint csoport tagságát jelző változó neve; a csoportot az azonosítója jelöli, így átnevezhető. */
export function groupVariable(groupId: number): string {
  return `[Group:${groupId}]`;
}

/** A csoport azonosítója, ha a név csoporttagság-változó. */
export function parseGroupVariable(name: string): number | undefined {
  const match: RegExpMatchArray | null = name.match(GROUP_VARIABLE);
  return match ? Number(match[1]) : undefined;
}

function collectFromCondition(condition: Condition | undefined, found: number[]): void {
  if (!condition) {
    return;
  }
  if ('all' in condition) {
    condition.all.forEach((child) => collectFromCondition(child, found));
  } else if ('any' in condition) {
    condition.any.forEach((child) => collectFromCondition(child, found));
  } else if ('not' in condition) {
    collectFromCondition(condition.not, found);
  } else {
    const groupId: number | undefined = parseGroupVariable(condition.field);
    if (groupId !== undefined && found.indexOf(groupId) === -1) {
      found.push(groupId);
    }
  }
}

/** Azok a SharePoint csoportok, amelyek tagságára a konfiguráció bármelyik feltétele hivatkozik. */
export function collectGroupIds(config: IFormConfig): number[] {
  const found: number[] = [];
  // A feltételes értékek (címke, cím, leírás, …) szabályainak feltételei.
  const collectFromRules = (conditional: Record<string, IConditionalValue[] | undefined> | undefined): void => {
    Object.keys(conditional ?? {}).forEach((property) =>
      (conditional?.[property] ?? []).forEach((rule) => collectFromCondition(rule.when, found))
    );
  };
  config.sections.forEach((section) => {
    collectFromCondition(section.visibleWhen, found);
    collectFromRules(section.conditional);
  });
  Object.keys(config.fields).forEach((name) => {
    collectFromCondition(config.fields[name].visibleWhen, found);
    collectFromCondition(config.fields[name].readOnlyWhen, found);
    collectFromCondition(config.fields[name].requiredWhen, found);
    collectFromRules(config.fields[name].conditional);
  });
  return found.sort((a, b) => a - b);
}

/**
 * A környezeti változók értékei a feltételek kiértékeléséhez. A konfigurációban hivatkozott minden csoport
 * kap értéket: `1`, ha a felhasználó tagja, különben `0`.
 */
export function contextValues(
  config: IFormConfig,
  mode: FormMode,
  memberGroupIds: number[],
  isAuthor: boolean = false
): FormValues {
  const values: FormValues = {};
  // Új elemnél a kitöltő lesz a létrehozó, ezért ott mindig igaz.
  values[AUTHOR_VARIABLE] = mode === 'new' || isAuthor ? TRUE_VALUE : FALSE_VALUE;
  (Object.keys(MODE_VARIABLES) as FormMode[]).forEach((key) => {
    values[MODE_VARIABLES[key]] = key === mode ? TRUE_VALUE : FALSE_VALUE;
  });
  collectGroupIds(config).forEach((groupId) => {
    values[groupVariable(groupId)] = memberGroupIds.indexOf(groupId) !== -1 ? TRUE_VALUE : FALSE_VALUE;
  });
  return values;
}

/** Egy SharePoint csoportba felvett címtárbeli tag, amelyen keresztül a felhasználó közvetve tag lehet. */
export type DirectoryClaim =
  | { kind: 'everyone' }
  /** „Mindenki, kivéve a külső felhasználókat”. */
  | { kind: 'allInternal' }
  /** Entra (Azure AD) biztonsági csoport vagy Microsoft 365 csoport tagjai; az `id` a címtárbeli azonosító. */
  | { kind: 'directoryGroup'; id: string };

const EVERYONE_CLAIM: string = 'c:0(.s|true';
const ALL_INTERNAL_CLAIM: string = 'c:0-.f|rolemanager|spo-grid-all-users/';
const DIRECTORY_GROUP_CLAIM: RegExp =
  /^c:0(?:t\.c\|tenant|o\.c\|federateddirectoryclaimprovider)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Egy csoporttag bejelentkezési nevének (claim) értelmezése. `undefined`, ha a tag nem címtárbeli csoport
 * (például egy felhasználó), vagy a tagsága innen nem dönthető el (a Microsoft 365 csoport tulajdonosai, `_o`).
 */
export function parseDirectoryClaim(loginName: string): DirectoryClaim | undefined {
  const login: string = loginName.trim().toLowerCase();
  if (login === EVERYONE_CLAIM) {
    return { kind: 'everyone' };
  }
  if (login.indexOf(ALL_INTERNAL_CLAIM) === 0) {
    return { kind: 'allInternal' };
  }
  const match: RegExpMatchArray | null = login.match(DIRECTORY_GROUP_CLAIM);
  return match ? { kind: 'directoryGroup', id: match[1] } : undefined;
}

/**
 * Tag-e a felhasználó a csoport címtárbeli tagjain keresztül. A `directoryGroupIds` a felhasználó címtárbeli
 * csoportjainak azonosítói (közvetett tagságokkal együtt); `undefined`, ha nem sikerült lekérdezni.
 */
export function isMemberByClaims(
  claims: DirectoryClaim[],
  directoryGroupIds: string[] | undefined,
  isGuest: boolean
): boolean {
  return claims.some((claim) => {
    switch (claim.kind) {
      case 'everyone':
        return true;
      case 'allInternal':
        return !isGuest;
      default:
        return directoryGroupIds !== undefined && directoryGroupIds.indexOf(claim.id) !== -1;
    }
  });
}
