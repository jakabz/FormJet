import { IFieldSchema } from '../../models/IFieldSchema';
import { IFormConfig } from '../../models/IFormConfig';
import {
  createDefaultConfig,
  flattenFields,
  getInitialValues,
  isEditableField,
  parseConfig,
  resolveDateDefault,
  resolveForm,
  unplacedFields
} from '../LayoutResolver';
import { configJson, field, getField, loadSampleConfig, readSampleConfig, sampleSchema } from './helpers';

const LIST_ID: string = '11111111-2222-3333-4444-555555555555';

describe('LayoutResolver – példa konfiguráció (samples/config-example.json)', () => {
  const schema: IFieldSchema[] = sampleSchema();
  const config: IFormConfig = loadSampleConfig();

  it('a példa konfiguráció érvényes', () => {
    const result = parseConfig(readSampleConfig());
    expect(result.error).toBeUndefined();
    expect(result.config).toBeDefined();
  });

  it('New módban a Jóváhagyás szekció és a mezői nem látszanak', () => {
    const form = resolveForm(schema, config, 'new', getInitialValues(schema, config));
    expect(form.sections[1].visible).toBe(false);
    expect(getField(form, 'Approver').visible).toBe(false);
  });

  it('New módban a Justification rejtett, a kötelezőségek érvényesek', () => {
    const form = resolveForm(schema, config, 'new', getInitialValues(schema, config));
    expect(getField(form, 'Justification').visible).toBe(false);
    expect(getField(form, 'Title').required).toBe(true);
    expect(getField(form, 'Amount').required).toBe(true);
  });

  it('Edit módban 500 000 feletti összegnél a Justification látható és kötelező', () => {
    const form = resolveForm(schema, config, 'edit', { Amount: '600 000,00' });
    expect(getField(form, 'Justification').visible).toBe(true);
    expect(getField(form, 'Justification').required).toBe(true);
  });

  it('Edit módban pontosan 500 000-nél a Justification rejtett és nem kötelező', () => {
    const form = resolveForm(schema, config, 'edit', { Amount: '500000' });
    expect(getField(form, 'Justification').visible).toBe(false);
    expect(getField(form, 'Justification').required).toBe(false);
  });

  it('Edit módban a Jóváhagyás szekció látszik, az Approver csak olvasható', () => {
    const form = resolveForm(schema, config, 'edit', {});
    expect(form.sections[1].visible).toBe(true);
    expect(getField(form, 'Approver').readOnly).toBe(true);
  });

  it('Display módban minden csak olvasható, és semmi nem kötelező', () => {
    const form = resolveForm(schema, config, 'display', { Amount: '750000' });
    flattenFields(form).forEach((item) => {
      expect(item.readOnly).toBe(true);
      expect(item.required).toBe(false);
    });
    expect(getField(form, 'Justification').visible).toBe(true);
  });

  it('az ApprovalComment csak a megadott állapotoknál látszik', () => {
    expect(getField(resolveForm(schema, config, 'edit', { ApprovalStatus: 'elutasítva' }), 'ApprovalComment').visible).toBe(true);
    expect(getField(resolveForm(schema, config, 'edit', {}), 'ApprovalComment').visible).toBe(false);
  });

  it('a kezdőértékek a konfigurációból jönnek', () => {
    expect(getInitialValues(schema, config).Category).toBe('Irodaszer');
  });

  it('a stílus módonként feloldva kerül a formra, szekcióra és mezőre', () => {
    const newForm = resolveForm(schema, config, 'new', {});
    const editForm = resolveForm(schema, config, 'edit', { Amount: '600 000' });
    const displayForm = resolveForm(schema, config, 'display', {});
    expect(newForm.style.accentColor).toBe('#107c10');
    expect(editForm.style.accentColor).toBe('#0f6cbd');
    expect(displayForm.style.density).toBe('compact');
    expect(editForm.sections[1].style.headerColor).toBe('#c43501');
    expect(editForm.sections[0].style).toEqual({});
    expect(getField(editForm, 'Justification').style.background).toBe('#fff4ce');
    expect(getField(displayForm, 'Justification').style).toEqual({});
    expect(newForm.mode).toBe('new');
  });

  it('a kapcsolódó elemek szekció New módban rejtett, egyébként látszik', () => {
    const newForm = resolveForm(schema, config, 'new', {});
    const editForm = resolveForm(schema, config, 'edit', {});
    expect(newForm.sections[2].visible).toBe(false);
    expect(newForm.sections[2].related).toBeUndefined();
    expect(editForm.sections[2].visible).toBe(true);
    expect(editForm.sections[2].related?.matchField).toBe('RequestNumber');
  });
});

describe('LayoutResolver – általános viselkedés', () => {
  const schema: IFieldSchema[] = [...sampleSchema(), field('Extra', 'Text')];

  it('unplacedFields: a szekcióban nem szereplő mezők', () => {
    expect(unplacedFields(schema, loadSampleConfig()).map((item) => item.InternalName)).toEqual(['Extra']);
  });

  it('createDefaultConfig: minden mező egy szekcióban', () => {
    const config = createDefaultConfig(LIST_ID, '0x01', schema);
    expect(config.sections).toHaveLength(1);
    expect(config.sections[0].fields).toHaveLength(schema.length);
    expect(config.listId).toBe(LIST_ID);
  });

  it('nem létező mezőre hivatkozó konfiguráció: a mező kimarad, és a hiányzók között szerepel', () => {
    const config = parseConfig(configJson({ sections: [{ id: 's', columns: 1, fields: [{ field: 'Nope' }, { field: 'Title' }] }] })).config;
    const form = resolveForm(schema, config as IFormConfig, 'new', {});
    expect(form.missingFields).toEqual(['Nope']);
    expect(flattenFields(form).map((item) => item.name)).toEqual(['Title']);
  });

  it('egy mező csak egyszer jelenik meg, az első elhelyezés számít', () => {
    const config = parseConfig(
      configJson({
        sections: [
          { id: 'a', columns: 1, fields: [{ field: 'Title' }] },
          { id: 'b', columns: 1, fields: [{ field: 'Title' }] }
        ]
      })
    ).config as IFormConfig;
    const form = resolveForm(schema, config, 'new', {});
    expect(form.sections[0].fields).toHaveLength(1);
    expect(form.sections[1].fields).toHaveLength(0);
  });

  it('a kötelezőség csak szigorítható: a séma szerint kötelező mező nem tehető opcionálissá', () => {
    const config = parseConfig(configJson({ sections: [{ id: 's', columns: 1, fields: [{ field: 'Title' }] }], fields: { Title: { requiredIn: [] } } }))
      .config as IFormConfig;
    expect(getField(resolveForm(schema, config, 'edit', {}), 'Title').required).toBe(true);
  });

  it('rejtett szekció mezői sem láthatók', () => {
    const config = parseConfig(configJson({ sections: [{ id: 's', columns: 1, visibleIn: ['edit'], fields: [{ field: 'Title' }] }] }))
      .config as IFormConfig;
    expect(getField(resolveForm(schema, config, 'new', {}), 'Title').visible).toBe(false);
    expect(getField(resolveForm(schema, config, 'edit', {}), 'Title').visible).toBe(true);
  });

  it('a colSpan nem lehet nagyobb a szekció oszlopszámánál, az oszlopszám 1 és 4 közé esik', () => {
    const config = parseConfig(configJson({ sections: [{ id: 's', columns: 9, fields: [{ field: 'Title', colSpan: 7 }] }] })).config as IFormConfig;
    const form = resolveForm(schema, config, 'new', {});
    expect(form.sections[0].columns).toBe(4);
    expect(form.sections[0].fields[0].colSpan).toBe(4);
  });
});

describe('LayoutResolver – szerkeszthetőség', () => {
  it('a támogatott típusok szerkeszthetők', () => {
    ['Text', 'Note', 'Number', 'Currency', 'Choice', 'MultiChoice', 'Boolean', 'DateTime', 'User', 'UserMulti', 'URL', 'Attachments', 'Location', 'Thumbnail'].forEach(
      (type) => expect(isEditableField(field('F', type))).toBe(true)
    );
  });

  it('a rendszer által csak olvashatónak jelölt és az ismeretlen típusú mező nem szerkeszthető', () => {
    expect(isEditableField(field('F', 'Text', { ReadOnlyField: true }))).toBe(false);
    expect(isEditableField(field('F', 'Calculated'))).toBe(false);
  });

  it('keresőmező és felügyelt metaadat csak akkor szerkeszthető, ha van hozzá lista, illetve kifejezéskészlet', () => {
    expect(isEditableField(field('F', 'Lookup'))).toBe(false);
    expect(isEditableField(field('F', 'Lookup', { LookupListId: LIST_ID }))).toBe(true);
    expect(isEditableField(field('F', 'LookupMulti', { LookupListId: LIST_ID }))).toBe(true);
    expect(isEditableField(field('F', 'TaxonomyFieldType'))).toBe(false);
    expect(isEditableField(field('F', 'TaxonomyFieldTypeMulti', { TermSetId: LIST_ID }))).toBe(true);
  });
});

describe('LayoutResolver – parseConfig', () => {
  it('hibás JSON, nem objektum gyökér és ismeretlen sémaverzió hibát ad', () => {
    expect(parseConfig('{nope').error).toBeDefined();
    expect(parseConfig('[]').error).toBeDefined();
    expect(parseConfig(configJson({ schemaVersion: 3 })).error).toBeDefined();
    expect(parseConfig(configJson({ sections: 'x' })).error).toBeDefined();
    expect(parseConfig(configJson({ fields: [] })).error).toBeDefined();
  });

  it('hibás feltétel, mód vagy ismétlődő szekcióazonosító hibát ad', () => {
    expect(parseConfig(configJson({ fields: { A: { visibleWhen: { field: 'A', op: 'like', value: 1 } } } })).error).toBeDefined();
    expect(parseConfig(configJson({ fields: { A: { visibleIn: ['print'] } } })).error).toBeDefined();
    expect(
      parseConfig(configJson({ sections: [{ id: 's', columns: 1, fields: [] }, { id: 's', columns: 1, fields: [] }] })).error
    ).toBeDefined();
    expect(parseConfig(configJson({ sections: [{ id: 's', columns: 1, fields: [{ colSpan: 2 }] }] })).error).toBeDefined();
  });

  it('a megjelenítési beállítások ellenőrzöttek, az alapértelmezés nem tárolódik', () => {
    expect(parseConfig(configJson({ fields: { A: { lookupDisplay: 'grid' } } })).error).toBeDefined();
    expect(parseConfig(configJson({ fields: { A: { attachmentsDisplay: 'grid' } } })).error).toBeDefined();
    const config = parseConfig(configJson({ fields: { A: { lookupDisplay: 'auto', attachmentsDisplay: 'list' }, B: { lookupDisplay: 'dropdown', attachmentsDisplay: 'compact' } } }))
      .config as IFormConfig;
    expect(config.fields.A).toEqual({});
    expect(config.fields.B).toEqual({ lookupDisplay: 'dropdown', attachmentsDisplay: 'compact' });
  });

  it('a hibaüzenet megnevezi a hibás elem útvonalát', () => {
    expect(parseConfig(configJson({ fields: { A: { lookupDisplay: 'grid' } } })).error).toContain('fields.A.lookupDisplay');
  });
});

describe('LayoutResolver – kezdőértékek', () => {
  const now: Date = new Date(2026, 9, 11, 10, 23, 40);
  const termA: string = '3f2a1b4c-0000-4000-8000-0000000000a1';
  const termB: string = '7c1b1b4c-0000-4000-8000-0000000000b2';
  const empty: IFormConfig = parseConfig(configJson()).config as IFormConfig;

  it('egyszerű típusok: a séma alapértéke, több választásnál form-stringgé alakítva', () => {
    const schema = [field('T', 'Text', { DefaultValue: 'x' }), field('M', 'MultiChoice', { DefaultValue: 'A' }), field('B', 'Boolean', { DefaultValue: '1' })];
    expect(getInitialValues(schema, empty, 'hu-HU', now)).toEqual({ T: 'x', M: ';#A;#', B: '1' });
  });

  it('a tervezőben megadott kezdőérték felülírja a séma alapértékét', () => {
    const config = parseConfig(configJson({ fields: { T: { defaultValue: 'saját' } } })).config as IFormConfig;
    expect(getInitialValues([field('T', 'Text', { DefaultValue: 'x' })], config, 'hu-HU', now).T).toBe('saját');
  });

  it('szám: a web tizedesjelével, százalékos mezőnél százalékértékként', () => {
    const schema = [
      field('Pct', 'Number', { DefaultValue: '0.25', Percentage: true }),
      field('Num', 'Number', { DefaultValue: '0.25' }),
      field('Cur', 'Currency', { DefaultValue: '100.5' })
    ];
    expect(getInitialValues(schema, empty, 'hu-HU', now)).toEqual({ Pct: '25', Num: '0,25', Cur: '100,5' });
    expect(getInitialValues(schema, empty, 'en-US', now)).toEqual({ Pct: '25', Num: '0.25', Cur: '100.5' });
  });

  it('dátum: a [today] a mai nap, dátum + idő mezőnél a mostani idő 5 percre kerekítve', () => {
    const schema = [
      field('D', 'DateTime', { DateOnly: true, DefaultValue: '[today]' }),
      field('DT', 'DateTime', { DateOnly: false, DefaultValue: '[Today]' }),
      field('None', 'DateTime', { DateOnly: true }),
      field('Calc', 'DateTime', { DateOnly: true, DefaultValue: '=Today+7' })
    ];
    expect(getInitialValues(schema, empty, 'hu-HU', now)).toEqual({ D: '2026. 10. 11.', DT: '2026. 10. 11. 10:25' });
    expect(getInitialValues(schema, empty, 'en-US', now).D).toBe('10/11/2026');
  });

  it('resolveDateDefault: a web formátumában megadott dátumot egységes alakra hozza, a nem dátumot elutasítja', () => {
    expect(resolveDateDefault('2026.3.5', 'hu-HU', true, now)).toBe('2026. 03. 05.');
    expect(resolveDateDefault('valami', 'hu-HU', true, now)).toBeUndefined();
    // Az ISO alakban tárolt rögzített dátum a böngésző időzónája szerint alakul át; déli időpontnál a nap biztosan egyezik.
    expect(resolveDateDefault('2026-12-24T12:00:00Z', 'hu-HU', true, now)).toBe('2026. 12. 24.');
  });

  it('személy: a [me] a bejelentkezett felhasználó; nélküle a mező üres marad', () => {
    const schema = [field('P', 'User'), field('PM', 'UserMulti')];
    const config = parseConfig(
      configJson({ fields: { P: { defaultValue: '[me]' }, PM: { defaultValue: '[me];bela@contoso.com' } } })
    ).config as IFormConfig;
    const me = { loginName: 'anna@contoso.com', displayName: 'Kiss Anna' };
    const meEntry = { Key: 'i:0#.f|membership|anna@contoso.com', DisplayText: 'Kiss Anna' };
    expect(getInitialValues(schema, config, 'hu-HU', now, me)).toEqual({
      P: JSON.stringify([meEntry]),
      PM: JSON.stringify([meEntry, { Key: 'bela@contoso.com', DisplayText: 'bela@contoso.com' }])
    });
    expect(getInitialValues(schema, config, 'hu-HU', now)).toEqual({
      PM: JSON.stringify([{ Key: 'bela@contoso.com', DisplayText: 'bela@contoso.com' }])
    });
  });

  it('felügyelt metaadat: a belső sorszámos alapértékből form-string lesz', () => {
    const schema = [
      field('One', 'TaxonomyFieldType', { TermSetId: termA, DefaultValue: `3;#Budapest|${termA}` }),
      field('Many', 'TaxonomyFieldTypeMulti', { TermSetId: termA, DefaultValue: `1;#Budapest|${termA};#2;#Győr|${termB}` }),
      field('Bad', 'TaxonomyFieldType', { TermSetId: termA, DefaultValue: 'valami' })
    ];
    expect(getInitialValues(schema, empty, 'hu-HU', now)).toEqual({
      One: `Budapest|${termA};`,
      Many: `Budapest|${termA};Győr|${termB};`
    });
  });
});

describe('LayoutResolver – mellékletek és megjelenítési beállítások', () => {
  const schema: IFieldSchema[] = [...sampleSchema(), field('Attachments', 'Attachments'), field('Tags', 'LookupMulti', { LookupListId: LIST_ID })];

  it('a mentett elrendezésben a mellékletek nem elhelyezett mezőként szerepelnek', () => {
    expect(unplacedFields(schema, loadSampleConfig()).map((item) => item.InternalName)).toEqual(['Attachments', 'Tags']);
  });

  it('az alapértelmezett elrendezésben szerepelnek; display módban csak olvashatók', () => {
    const config = createDefaultConfig(LIST_ID, '0x01', schema);
    expect(getField(resolveForm(schema, config, 'new', {}), 'Attachments').readOnly).toBe(false);
    expect(getField(resolveForm(schema, config, 'new', {}), 'Attachments').attachmentsDisplay).toBe('list');
    expect(getField(resolveForm(schema, config, 'display', {}), 'Attachments').readOnly).toBe(true);
  });

  it('a mezőnkénti megjelenítési beállítás a feloldott mezőre kerül', () => {
    const config = parseConfig(
      configJson({
        sections: [{ id: 's', columns: 1, fields: [{ field: 'Attachments' }, { field: 'Tags' }] }],
        fields: { Attachments: { attachmentsDisplay: 'compact', requiredIn: ['new'] }, Tags: { lookupDisplay: 'checklist' } }
      })
    ).config as IFormConfig;
    const form = resolveForm(schema, config, 'new', {});
    expect(getField(form, 'Attachments').attachmentsDisplay).toBe('compact');
    expect(getField(form, 'Attachments').required).toBe(true);
    expect(getField(form, 'Tags').lookupDisplay).toBe('checklist');
  });
});
