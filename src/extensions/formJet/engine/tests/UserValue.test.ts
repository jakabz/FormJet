import { ICurrentUser, parseUserValue, resolveUserDefault } from '../UserValue';

describe('UserValue – kezdőérték (resolveUserDefault)', () => {
  const me: ICurrentUser = { loginName: 'anna@contoso.com', displayName: 'Kiss Anna', email: 'anna.kiss@contoso.com' };
  const meKey: string = 'i:0#.f|membership|anna@contoso.com';

  it('a [me] a bejelentkezett felhasználó, claims kulccsal és névvel', () => {
    expect(parseUserValue(resolveUserDefault('[me]', false, me))).toEqual([{ key: meKey, text: 'Kiss Anna', secondaryText: undefined }]);
    expect(resolveUserDefault(' [Me] ', false, me)).toBe(JSON.stringify([{ Key: meKey, DisplayText: 'Kiss Anna' }]));
  });

  it('a már claims alakú bejelentkezési név nem kap újabb előtagot', () => {
    const value = resolveUserDefault('[me]', false, { loginName: meKey, displayName: 'Kiss Anna' });
    expect(parseUserValue(value)[0].key).toBe(meKey);
  });

  it('bejelentkezett felhasználó nélkül a [me] kimarad', () => {
    expect(resolveUserDefault('[me]', false)).toBe('');
    expect(resolveUserDefault('[me]', false, { loginName: '', displayName: '' })).toBe('');
  });

  it('az e-mail-cím változatlanul kerül a kulcsba', () => {
    expect(resolveUserDefault('bela@contoso.com', false, me)).toBe(
      JSON.stringify([{ Key: 'bela@contoso.com', DisplayText: 'bela@contoso.com' }])
    );
  });

  it('több érték pontosvesszővel: többértékű mezőnél mind, ismétlődés nélkül; egyértékűnél csak az első', () => {
    const raw: string = 'bela@contoso.com; [me];BELA@contoso.com;;[me]';
    expect(parseUserValue(resolveUserDefault(raw, true, me)).map((entry) => entry.key)).toEqual(['bela@contoso.com', meKey]);
    expect(parseUserValue(resolveUserDefault(raw, false, me)).map((entry) => entry.key)).toEqual(['bela@contoso.com']);
  });

  it('a kész form-string (JSON tömb) megmarad', () => {
    const raw: string = JSON.stringify([{ Key: meKey }, { Key: 'Jóváhagyók' }]);
    expect(parseUserValue(resolveUserDefault(raw, true, me)).map((entry) => entry.key)).toEqual([meKey, 'Jóváhagyók']);
  });

  it('üres értékre üres szöveg', () => {
    expect(resolveUserDefault('', true, me)).toBe('');
    expect(resolveUserDefault(' ; ', true, me)).toBe('');
  });
});
