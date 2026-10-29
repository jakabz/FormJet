import { IFieldSchema } from '../../models/IFieldSchema';
import { IFormConfig } from '../../models/IFormConfig';
import { getInitialValues, isEditableField, parseConfig, resolveForm, unplacedFields } from '../LayoutResolver';
import {
  addTextElement,
  BUTTON_ELEMENT_TYPE,
  isTextElement,
  removeTextElement,
  TEXT_ELEMENT_TYPE,
  withTextElements
} from '../TextElement';
import { configJson, field, getField } from './helpers';

function load(patch: Record<string, unknown> = {}): IFormConfig {
  const result = parseConfig(configJson(patch));
  if (!result.config) {
    throw new Error(result.error);
  }
  return result.config;
}

describe('TextElement – szövegelemek', () => {
  const schema: IFieldSchema[] = [field('Title', 'Text'), field('Amount', 'Number')];
  const sections = [
    { id: 'a', columns: 1, fields: [{ field: 'Title' }] },
    { id: 'b', columns: 1, fields: [{ field: 'Amount' }] }
  ];

  it('az 1-es és 2-es sémaverziójú konfiguráció érvényes marad, és az aktuális verzióra kerül', () => {
    expect(load({ schemaVersion: 1 }).schemaVersion).toBe(5);
    expect(load({ schemaVersion: 2 }).schemaVersion).toBe(5);
    expect(load({ schemaVersion: 3 }).schemaVersion).toBe(5);
    expect(load({ schemaVersion: 4 }).schemaVersion).toBe(5);
  });

  it('parseConfig: a szövegelemek megmaradnak; hibás azonosító vagy hiányzó megnevezés hibát ad', () => {
    const config = load({ texts: { 'text:1': { name: 'Tájékoztató', content: 'Első sor\nMásodik sor' }, 'text:2': { name: 'Üres' } } });
    expect(config.texts).toEqual({ 'text:1': { name: 'Tájékoztató', content: 'Első sor\nMásodik sor' }, 'text:2': { name: 'Üres' } });
    expect(load().texts).toBeUndefined();
    expect(parseConfig(configJson({ texts: { Title: { name: 'x' } } })).error).toContain('texts.Title');
    expect(parseConfig(configJson({ texts: { 'text:1': { content: 'x' } } })).error).toContain('texts.text:1');
    expect(parseConfig(configJson({ texts: [] })).error).toBeDefined();
  });

  it('withTextElements: a szövegelem csak olvasható pszeudo-mező; ismételt hívásra nem kettőződik', () => {
    const config = load({ texts: { 'text:1': { name: 'Tájékoztató' } } });
    const merged = withTextElements(schema, config);
    expect(merged.map((item) => item.InternalName)).toEqual(['Title', 'Amount', 'text:1']);
    expect(merged[2]).toEqual({ InternalName: 'text:1', Title: 'Tájékoztató', TypeAsString: TEXT_ELEMENT_TYPE, Required: false, ReadOnlyField: true });
    expect(isTextElement(merged[2])).toBe(true);
    expect(isEditableField(merged[2])).toBe(false);
    expect(withTextElements(merged, config)).toBe(merged);
    expect(withTextElements(schema, load())).toBe(schema);
  });

  it('addTextElement: a megadott szekció végére kerül, ennek hiányában az utolsóéra; az azonosító egyedi', () => {
    const first = addTextElement(load({ sections }), 'Első', 'a');
    expect(first.id).toBe('text:1');
    expect(first.config.texts).toEqual({ 'text:1': { name: 'Első' } });
    expect(first.config.sections[0].fields.map((item) => item.field)).toEqual(['Title', 'text:1']);

    const second = addTextElement(first.config, 'Második');
    expect(second.id).toBe('text:2');
    expect(second.config.sections[1].fields.map((item) => item.field)).toEqual(['Amount', 'text:2']);

    // Törlés után az új azonosító nem ütközhet a megmaradt elemével.
    const third = addTextElement(removeTextElement(second.config, 'text:1'), 'Harmadik', 'nincs ilyen');
    expect(third.id).toBe('text:3');
    expect(Object.keys(third.config.texts ?? {}).sort()).toEqual(['text:2', 'text:3']);

    const unplaced = addTextElement(load({ sections: [] }), 'Szekció nélkül');
    expect(unplacedFields(schema, unplaced.config).map((item) => item.InternalName)).toEqual(['Title', 'Amount', 'text:1']);
  });

  it('removeTextElement: az elhelyezés, a beállítás és maga az elem is megszűnik', () => {
    const config = load({
      sections: [{ id: 'a', columns: 1, fields: [{ field: 'Title' }, { field: 'text:1' }] }],
      fields: { 'text:1': { visibleIn: ['new'] }, Title: { label: 'Cím' } },
      texts: { 'text:1': { name: 'Első' } }
    });
    const next = removeTextElement(config, 'text:1');
    expect(next.sections[0].fields).toEqual([{ field: 'Title' }]);
    expect(next.fields).toEqual({ Title: { label: 'Cím' } });
    expect(next.texts).toBeUndefined();
    // Az eredeti konfiguráció nem módosul.
    expect(config.texts).toEqual({ 'text:1': { name: 'Első' } });
  });

  it('resolveForm: a szövegelem a tartalmával jelenik meg, csak olvasható, és a megadott módokban látszik', () => {
    const config = load({
      sections: [{ id: 'a', columns: 2, fields: [{ field: 'Title' }, { field: 'text:1', colSpan: 2 }] }],
      fields: { 'text:1': { visibleIn: ['new', 'edit'], style: { base: { background: '#fff4ce', textColor: '#a4262c' } } } },
      texts: { 'text:1': { name: 'Figyelmeztetés', content: 'Töltsd ki pontosan!' } }
    });
    const form = resolveForm(schema, config, 'new', {});
    const text = getField(form, 'text:1');
    expect(form.missingFields).toEqual([]);
    expect(text.text).toBe('Töltsd ki pontosan!');
    expect(text.visible).toBe(true);
    expect(text.readOnly).toBe(true);
    expect(text.required).toBe(false);
    expect(text.colSpan).toBe(2);
    expect(text.style).toEqual({ background: '#fff4ce', textColor: '#a4262c' });
    expect(getField(form, 'Title').text).toBeUndefined();
    expect(getField(resolveForm(schema, config, 'display', {}), 'text:1').visible).toBe(false);
  });

  it('a szövegelemnek nincs kezdőértéke, és a törölt elem elhelyezése hiányzó mezőként jelenik meg', () => {
    const config = load({
      sections: [{ id: 'a', columns: 1, fields: [{ field: 'text:9' }] }],
      fields: { 'text:1': { defaultValue: 'x' } },
      texts: { 'text:1': { name: 'Első' } }
    });
    expect(getInitialValues(schema, config, 'hu-HU')).toEqual({});
    expect(resolveForm(schema, config, 'new', {}).missingFields).toEqual(['text:9']);
  });
});

describe('TextElement – gombok', () => {
  const schema: IFieldSchema[] = [field('Title', 'Text', { Required: true })];

  it('addTextElement: a gomb saját előtagot és sorszámot kap, a felirat számozása független tőle', () => {
    const base = load({ sections: [{ id: 'a', columns: 1, fields: [] }], texts: { 'text:1': { name: 'Első felirat' } } });
    const added = addTextElement(base, 'Megnyitás', 'a', 'button');
    expect(added.id).toBe('button:1');
    expect(added.config.texts?.['button:1']).toEqual({ kind: 'button', name: 'Megnyitás' });
    expect(addTextElement(added.config, 'Második felirat', 'a').id).toBe('text:2');
    expect(withTextElements(schema, added.config).map((item) => item.TypeAsString)).toEqual(['Text', TEXT_ELEMENT_TYPE, BUTTON_ELEMENT_TYPE]);
  });

  it('parseConfig: a gomb címe és új lapos megnyitása megmarad; a fajta és az előtag összetartozik', () => {
    const config = load({ texts: { 'button:1': { kind: 'button', name: 'Súgó', url: ' https://contoso.com ', newTab: true, content: 'x' } } });
    expect(config.texts).toEqual({ 'button:1': { kind: 'button', name: 'Súgó', url: 'https://contoso.com', newTab: true } });
    expect(parseConfig(configJson({ texts: { 'button:1': { name: 'x' } } })).error).toContain('texts.button:1');
    expect(parseConfig(configJson({ texts: { 'text:1': { kind: 'button', name: 'x' } } })).error).toContain('texts.text:1');
    expect(parseConfig(configJson({ texts: { 'button:1': { kind: 'link', name: 'x' } } })).error).toBeDefined();
  });

  it('resolveForm: a gomb megtekintéskor is használható; a letiltást csak a beállítás adja; soha nem kötelező', () => {
    const config = load({
      sections: [{ id: 'a', columns: 1, fields: [{ field: 'Title' }, { field: 'button:1' }] }],
      fields: {
        'button:1': {
          readOnlyIn: ['new'],
          readOnlyWhen: { field: 'Title', op: 'empty' },
          requiredIn: ['edit']
        }
      },
      texts: { 'button:1': { kind: 'button', name: 'Súgó', url: '/sites/x/help.aspx' } }
    });
    const display = getField(resolveForm(schema, config, 'display', { Title: 'x' }), 'button:1');
    expect([display.readOnly, display.required, display.label]).toEqual([false, false, 'Súgó']);
    expect(display.button).toEqual({ url: '/sites/x/help.aspx', newTab: false, icon: undefined, primary: false, actions: [] });
    expect(getField(resolveForm(schema, config, 'edit', { Title: 'x' }), 'button:1').readOnly).toBe(false);
    expect(getField(resolveForm(schema, config, 'edit', {}), 'button:1').readOnly).toBe(true);
    expect(getField(resolveForm(schema, config, 'new', { Title: 'x' }), 'button:1').readOnly).toBe(true);
    expect(getField(resolveForm(schema, config, 'edit', { Title: 'x' }), 'button:1').required).toBe(false);
    expect(getField(resolveForm(schema, config, 'edit', {}), 'Title').button).toBeUndefined();
  });
});
