import { IFieldSchema } from '../../models/IFieldSchema';
import { IFormConfig } from '../../models/IFormConfig';
import { effectiveActions, parseButtonActions } from '../ButtonAction';
import { parseConfig, resolveForm, unplacedFields } from '../LayoutResolver';
import { addFooterButton, createDefaultFooter, IFooterCaptions, removeFooter, removeTextElement } from '../TextElement';
import { configJson, field } from './helpers';

const CAPTIONS: IFooterCaptions = { save: 'Mentés', saveAndClose: 'Mentés és bezárás', cancel: 'Mégse', close: 'Bezárás' };

function load(patch: Record<string, unknown>): IFormConfig {
  const result = parseConfig(configJson(patch));
  if (!result.config) {
    throw new Error(result.error);
  }
  return result.config;
}

describe('Footer – testreszabható alsó gombsor', () => {
  const schema: IFieldSchema[] = [field('Title', 'Text'), field('Status', 'Choice')];

  it('createDefaultFooter: alapértelmezett mentésnél Mentés + Mégse, a Mégse megtekintéskor Bezárás', () => {
    const config = createDefaultFooter(load({ sections: [{ id: 's', columns: 1, fields: [{ field: 'Title' }] }] }), CAPTIONS);
    expect(config.footer).toEqual(['button:1', 'button:2']);
    expect(config.texts?.['button:1']).toEqual({ kind: 'button', name: 'Mentés', primary: true, actions: [{ type: 'save' }] });
    expect(config.texts?.['button:2']).toEqual({ kind: 'button', name: 'Mégse', actions: [{ type: 'close' }] });
    expect(config.fields['button:1']).toEqual({ visibleIn: ['new', 'edit'] });

    const edit = resolveForm(schema, config, 'edit', {});
    expect(edit.footer?.map((button) => [button.label, button.visible, button.button?.primary])).toEqual([
      ['Mentés', true, true],
      ['Mégse', true, false]
    ]);
    const display = resolveForm(schema, config, 'display', {});
    expect(display.footer?.map((button) => [button.label, button.visible])).toEqual([
      ['Mentés', false],
      ['Bezárás', true]
    ]);
    // A gombsor gombjai nem „elhelyezetlen” mezők, és a szakaszokban sem jelennek meg.
    expect(unplacedFields(schema, config).map((item) => item.InternalName)).toEqual(['Status']);
  });

  it('createDefaultFooter: bővített mentésnél Mentés (nyitva marad) + Mentés és bezárás + Mégse', () => {
    const config = createDefaultFooter(load({ saveMode: 'extended' }), CAPTIONS);
    expect(config.footer?.map((id) => [config.texts?.[id]?.name, config.texts?.[id]?.actions])).toEqual([
      ['Mentés', [{ type: 'save', keepOpen: true }]],
      ['Mentés és bezárás', [{ type: 'save' }]],
      ['Mégse', [{ type: 'close' }]]
    ]);
  });

  it('a beépített gombsornál (footer nélkül) a feloldott formnak nincs gombsora', () => {
    expect(resolveForm(schema, load({}), 'new', {}).footer).toBeUndefined();
  });

  it('addFooterButton / removeTextElement / removeFooter', () => {
    const base = createDefaultFooter(load({}), CAPTIONS);
    const added = addFooterButton(base, 'Submit');
    expect(added.id).toBe('button:3');
    expect(added.config.footer).toEqual(['button:1', 'button:2', 'button:3']);
    const removed = removeTextElement(added.config, 'button:1');
    expect(removed.footer).toEqual(['button:2', 'button:3']);
    expect(removed.fields['button:1']).toBeUndefined();
    const reset = removeFooter(added.config);
    expect(reset.footer).toBeUndefined();
    expect(reset.texts).toBeUndefined();
    expect(reset.fields).toEqual({});
  });

  it('parseConfig: a gombsorban csak létező gombok maradnak; a hibás szerkezet hibát ad', () => {
    const config = load({
      texts: { 'button:1': { kind: 'button', name: 'A', primary: true }, 'text:1': { name: 'Felirat' } },
      footer: ['button:1', 'text:1', 'button:9', 'button:1']
    });
    expect(config.footer).toEqual(['button:1']);
    expect(config.texts?.['button:1']).toEqual({ kind: 'button', name: 'A', primary: true });
    expect(load({ footer: [] }).footer).toEqual([]);
    expect(parseConfig(configJson({ footer: 'button:1' })).error).toContain('footer');
  });

  it('a „mentés, nyitva marad” lépés értelmezése; a mentés mindkét változata lezárja a sort', () => {
    expect(parseButtonActions([{ type: 'save', keepOpen: true }, { type: 'save', keepOpen: 'x' }], 'a')).toEqual([
      { type: 'save', keepOpen: true },
      { type: 'save' }
    ]);
    expect(effectiveActions([{ type: 'save', keepOpen: true }, { type: 'close' }])).toEqual([{ type: 'save', keepOpen: true }]);
  });

  it('a gomb feltételes felirata a mezők címkeszabályával működik', () => {
    const config = load({
      texts: { 'button:1': { kind: 'button', name: 'Beküldés' } },
      fields: { 'button:1': { conditional: { label: [{ when: { field: 'Status', op: 'eq', value: 'Draft' }, value: 'Submit' }] } } },
      footer: ['button:1']
    });
    expect(resolveForm(schema, config, 'edit', { Status: 'Draft' }).footer?.[0].label).toBe('Submit');
    expect(resolveForm(schema, config, 'edit', { Status: 'Submitted' }).footer?.[0].label).toBe('Beküldés');
  });
});
