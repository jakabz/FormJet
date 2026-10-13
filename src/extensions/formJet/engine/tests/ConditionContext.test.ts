import { IFieldSchema } from '../../models/IFieldSchema';
import { IFormConfig } from '../../models/IFormConfig';
import {
  collectGroupIds,
  contextValues,
  groupVariable,
  isMemberByClaims,
  MODE_VARIABLES,
  parseDirectoryClaim,
  parseGroupVariable
} from '../ConditionContext';
import { parseConfig, resolveForm } from '../LayoutResolver';
import { configJson, field, getField } from './helpers';

function load(patch: Record<string, unknown>): IFormConfig {
  const result = parseConfig(configJson(patch));
  if (!result.config) {
    throw new Error(result.error);
  }
  return result.config;
}

describe('ConditionContext – a form módja és a csoporttagság a feltételekben', () => {
  const schema: IFieldSchema[] = [field('Title', 'Text'), field('Amount', 'Number'), field('Comment', 'Note')];
  const config: IFormConfig = load({
    sections: [
      { id: 'a', columns: 1, fields: [{ field: 'Title' }, { field: 'Amount' }] },
      { id: 'b', columns: 1, visibleWhen: { field: '[Group:7]', op: 'eq', value: true }, fields: [{ field: 'Comment' }] }
    ],
    fields: {
      Title: { readOnlyWhen: { all: [{ field: '[IsEditMode]', op: 'eq', value: true }, { field: '[Group:5]', op: 'eq', value: false }] } },
      Amount: {
        visibleWhen: { any: [{ field: '[IsNewMode]', op: 'eq', value: true }, { not: { field: '[Group:12]', op: 'ne', value: true } }] },
        requiredWhen: { all: [{ field: '[IsDisplayMode]', op: 'eq', value: false }, { field: 'Title', op: 'notEmpty' }] }
      }
    }
  });

  it('a csoporttagság-változó neve oda-vissza alakítható; más név nem az', () => {
    expect(groupVariable(5)).toBe('[Group:5]');
    expect(parseGroupVariable('[Group:5]')).toBe(5);
    expect(parseGroupVariable('[Group:x]')).toBeUndefined();
    expect(parseGroupVariable('Group:5')).toBeUndefined();
    expect(parseGroupVariable(MODE_VARIABLES.new)).toBeUndefined();
  });

  it('collectGroupIds: a szekciók és a mezők minden feltételéből, beágyazva is, ismétlődés nélkül', () => {
    expect(collectGroupIds(config)).toEqual([5, 7, 12]);
    expect(collectGroupIds(load({}))).toEqual([]);
  });

  it('contextValues: pontosan egy módváltozó igaz; minden hivatkozott csoport kap értéket', () => {
    expect(contextValues(config, 'edit', [7, 99])).toEqual({
      '[IsAuthor]': '0',
      '[IsNewMode]': '0',
      '[IsEditMode]': '1',
      '[IsDisplayMode]': '0',
      '[Group:5]': '0',
      '[Group:7]': '1',
      '[Group:12]': '0'
    });
  });

  it('resolveForm: a módváltozó a mezőfeltételekkel együtt értékelődik ki', () => {
    // Szerkesztéskor, ha a felhasználó nem tagja az 5-ös csoportnak, a Title csak olvasható.
    expect(getField(resolveForm(schema, config, 'edit', {}), 'Title').readOnly).toBe(true);
    expect(getField(resolveForm(schema, config, 'edit', {}, [5]), 'Title').readOnly).toBe(false);
    expect(getField(resolveForm(schema, config, 'new', {}), 'Title').readOnly).toBe(false);
    // Az Amount új elemnél mindig látszik, egyébként csak a 12-es csoport tagjainak.
    expect(getField(resolveForm(schema, config, 'new', {}), 'Amount').visible).toBe(true);
    expect(getField(resolveForm(schema, config, 'edit', {}), 'Amount').visible).toBe(false);
    expect(getField(resolveForm(schema, config, 'edit', {}, [12]), 'Amount').visible).toBe(true);
    // Kötelező, ha nem megtekintés, és a Title ki van töltve.
    expect(getField(resolveForm(schema, config, 'new', { Title: 'x' }), 'Amount').required).toBe(true);
    expect(getField(resolveForm(schema, config, 'new', {}), 'Amount').required).toBe(false);
  });

  it('resolveForm: a szekció csak a csoport tagjainak látszik; a mezőérték nem írhatja felül a változót', () => {
    expect(resolveForm(schema, config, 'edit', {}).sections[1].visible).toBe(false);
    expect(resolveForm(schema, config, 'edit', {}, [7]).sections[1].visible).toBe(true);
    expect(resolveForm(schema, config, 'edit', { '[Group:7]': '1' }).sections[1].visible).toBe(false);
  });

  it('[IsAuthor]: igaz, ha a felhasználó az elem létrehozója; új elemnél mindig igaz', () => {
    const authorConfig = load({
      sections: [{ id: 'a', columns: 1, fields: [{ field: 'Title' }] }],
      fields: { Title: { readOnlyWhen: { field: '[IsAuthor]', op: 'eq', value: false } } }
    });
    expect(contextValues(authorConfig, 'edit', [], true)['[IsAuthor]']).toBe('1');
    expect(contextValues(authorConfig, 'display', [])['[IsAuthor]']).toBe('0');
    expect(contextValues(authorConfig, 'new', [], false)['[IsAuthor]']).toBe('1');
    // Szerkesztéskor csak a létrehozó írhatja a mezőt.
    expect(getField(resolveForm(schema, authorConfig, 'edit', {}), 'Title').readOnly).toBe(true);
    expect(getField(resolveForm(schema, authorConfig, 'edit', {}, [], true), 'Title').readOnly).toBe(false);
    expect(getField(resolveForm(schema, authorConfig, 'new', {}), 'Title').readOnly).toBe(false);
  });

  it('parseDirectoryClaim: a címtárbeli csoportok és a „Mindenki” jellegű tagok felismerése', () => {
    const id: string = '0f3a1b2c-1111-4222-8333-444455556666';
    expect(parseDirectoryClaim(`c:0t.c|tenant|${id}`)).toEqual({ kind: 'directoryGroup', id });
    expect(parseDirectoryClaim(`c:0o.c|federateddirectoryclaimprovider|${id.toUpperCase()}`)).toEqual({ kind: 'directoryGroup', id });
    expect(parseDirectoryClaim('c:0(.s|true')).toEqual({ kind: 'everyone' });
    expect(parseDirectoryClaim(`c:0-.f|rolemanager|spo-grid-all-users/${id}`)).toEqual({ kind: 'allInternal' });
    // Felhasználó, illetve a Microsoft 365 csoport tulajdonosai: innen nem dönthető el.
    expect(parseDirectoryClaim('i:0#.f|membership|anna@contoso.com')).toBeUndefined();
    expect(parseDirectoryClaim(`c:0o.c|federateddirectoryclaimprovider|${id}_o`)).toBeUndefined();
    expect(parseDirectoryClaim('')).toBeUndefined();
  });

  it('isMemberByClaims: címtárbeli csoporton, „Mindenki” tagon keresztül; vendég nem belső felhasználó', () => {
    const group = { kind: 'directoryGroup' as const, id: 'a' };
    expect(isMemberByClaims([group], ['b', 'a'], false)).toBe(true);
    expect(isMemberByClaims([group], ['b'], false)).toBe(false);
    // A címtárbeli csoportok lekérdezése nem sikerült: a tagság nem állapítható meg.
    expect(isMemberByClaims([group], undefined, false)).toBe(false);
    expect(isMemberByClaims([{ kind: 'everyone' }], undefined, true)).toBe(true);
    expect(isMemberByClaims([{ kind: 'allInternal' }], undefined, false)).toBe(true);
    expect(isMemberByClaims([{ kind: 'allInternal' }], undefined, true)).toBe(false);
    expect(isMemberByClaims([], ['a'], false)).toBe(false);
  });
});
