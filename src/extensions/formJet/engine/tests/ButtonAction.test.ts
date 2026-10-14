import { ButtonAction, IFormConfig } from '../../models/IFormConfig';
import { effectiveActions, endsSequence, isButtonSettableField, isIconName, parseButtonActions } from '../ButtonAction';
import { parseConfig, resolveFieldValue, resolveForm } from '../LayoutResolver';
import { configJson, field, getField } from './helpers';

function load(patch: Record<string, unknown>): IFormConfig {
  const result = parseConfig(configJson(patch));
  if (!result.config) {
    throw new Error(result.error);
  }
  return result.config;
}

describe('ButtonAction – a gomb műveletei és ikonja', () => {
  it('parseButtonActions: érvényes lépések; a félkész (mező nélküli) lépés megmarad; hibás szerkezet hibát ad', () => {
    expect(
      parseButtonActions(
        [{ type: 'setValue', field: 'Status', value: 'Jóváhagyva', extra: 1 }, { type: 'setValue', field: '' }, { type: 'save' }, { type: 'close', field: 'x' }],
        'a'
      )
    ).toEqual([
      { type: 'setValue', field: 'Status', value: 'Jóváhagyva' },
      { type: 'setValue', field: '', value: '' },
      { type: 'save' },
      { type: 'close' }
    ]);
    expect(parseButtonActions(undefined, 'a')).toBeUndefined();
    expect(parseButtonActions([], 'a')).toBeUndefined();
    expect(() => parseButtonActions({}, 'a')).toThrow('a');
    expect(() => parseButtonActions([{ type: 'run' }], 'a')).toThrow('a[0].type');
    expect(() => parseButtonActions([{ type: 'setValue', field: 'Bad name;' }], 'a')).toThrow('a[0].field');
  });

  it('effectiveActions: a mentés vagy a bezárás lezárja a sort', () => {
    const set: ButtonAction = { type: 'setValue', field: 'A', value: '1' };
    expect(effectiveActions([set, { type: 'save' }, set, { type: 'close' }])).toEqual([set, { type: 'save' }]);
    expect(effectiveActions([set, set])).toEqual([set, set]);
    expect(effectiveActions([{ type: 'close' }, { type: 'save' }])).toEqual([{ type: 'close' }]);
    expect([endsSequence('setValue'), endsSequence('save'), endsSequence('close')]).toEqual([false, true, true]);
  });

  it('isIconName: csak betűk és számok', () => {
    expect(isIconName('OpenInNewWindow')).toBe(true);
    expect(isIconName('Mail2')).toBe(true);
    expect(isIconName('Mail 2')).toBe(false);
    expect(isIconName('<b>')).toBe(false);
    expect(isIconName('')).toBe(false);
    expect(isIconName(undefined)).toBe(false);
  });

  it('parseConfig: a gomb ikonja és műveletei megmaradnak; a hibás ikonnév kimarad, az elrendezés érvényes marad', () => {
    const config = load({
      sections: [{ id: 'a', columns: 1, fields: [{ field: 'button:1' }] }],
      texts: {
        'button:1': { kind: 'button', name: 'Jóváhagyás', icon: 'Accept', actions: [{ type: 'setValue', field: 'Status', value: 'OK' }, { type: 'save' }] },
        'button:2': { kind: 'button', name: 'Rossz ikon', icon: 'not valid!' },
        'text:1': { name: 'Felirat', icon: 'Accept', actions: [{ type: 'save' }] }
      }
    });
    expect(config.texts?.['button:1']).toEqual({
      kind: 'button',
      name: 'Jóváhagyás',
      icon: 'Accept',
      actions: [{ type: 'setValue', field: 'Status', value: 'OK' }, { type: 'save' }]
    });
    expect(config.texts?.['button:2']).toEqual({ kind: 'button', name: 'Rossz ikon' });
    expect(config.texts?.['text:1']).toEqual({ name: 'Felirat' });
    const resolved = getField(resolveForm([], config, 'edit', {}), 'button:1').button;
    expect(resolved?.icon).toBe('Accept');
    expect(resolved?.actions).toHaveLength(2);
    expect(parseConfig(configJson({ texts: { 'button:1': { kind: 'button', name: 'x', actions: [{ type: 'nope' }] } } })).error).toContain(
      'texts.button:1.actions[0].type'
    );
  });

  it('resolveFieldValue: a kezdőérték formátuma szerint alakít (dátum, személy), egyébként változatlan', () => {
    const now: Date = new Date(2026, 9, 14, 9, 0, 0);
    const me = { loginName: 'anna@contoso.com', displayName: 'Kiss Anna' };
    expect(resolveFieldValue(field('D', 'DateTime', { DateOnly: true }), '[today]', 'hu-HU', now)).toBe('2026. 10. 14.');
    expect(resolveFieldValue(field('D', 'DateTime', { DateOnly: true }), 'nem dátum', 'hu-HU', now)).toBe('nem dátum');
    expect(resolveFieldValue(field('P', 'User'), '[me]', 'hu-HU', now, me)).toBe(
      JSON.stringify([{ Key: 'i:0#.f|membership|anna@contoso.com', DisplayText: 'Kiss Anna' }])
    );
    expect(resolveFieldValue(field('S', 'Choice'), 'Jóváhagyva', 'hu-HU', now)).toBe('Jóváhagyva');
    expect(resolveFieldValue(field('S', 'Choice'), '  ', 'hu-HU', now)).toBe('');
  });

  it('isButtonSettableField: a SharePoint szerint írható, form-string értékű mező; a melléklet, a kép és a csak olvasható nem', () => {
    expect(isButtonSettableField(field('Status', 'Choice'))).toBe(true);
    expect(isButtonSettableField(field('Approved', 'Boolean'))).toBe(true);
    expect(isButtonSettableField(field('Created', 'DateTime', { ReadOnlyField: true }))).toBe(false);
    expect(isButtonSettableField(field('Attachments', 'Attachments'))).toBe(false);
    expect(isButtonSettableField(field('Photo', 'Thumbnail'))).toBe(false);
    expect(isButtonSettableField(field('Calc', 'Calculated'))).toBe(false);
  });
});
