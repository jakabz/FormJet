import { IFieldSchema } from '../../models/IFieldSchema';
import { IConditionalValue, IFormConfig } from '../../models/IFormConfig';
import { countConditionalValues, pickConditionalValue, setConditionalValues } from '../ConditionalValue';
import { collectGroupIds } from '../ConditionContext';
import { getInitialValues, parseConfig, resolveForm } from '../LayoutResolver';
import { configJson, field, getField } from './helpers';

function load(patch: Record<string, unknown>): IFormConfig {
  const result = parseConfig(configJson(patch));
  if (!result.config) {
    throw new Error(result.error);
  }
  return result.config;
}

describe('ConditionalValue – feltételes címke, leírás, helykitöltő és kezdőérték', () => {
  const schema: IFieldSchema[] = [
    field('Title', 'Text', { Description: 'séma leírás' }),
    field('Category', 'Choice', { DefaultValue: 'Irodaszer' }),
    field('Owner', 'User'),
    field('Due', 'DateTime', { DateOnly: true })
  ];
  const sections = [{ id: 'a', columns: 1, fields: [{ field: 'Title' }, { field: 'Category' }, { field: 'Owner' }, { field: 'Due' }] }];
  const now: Date = new Date(2026, 9, 11, 10, 0, 0);

  it('pickConditionalValue: az első teljesülő szabály érvényes; a feltétel nélküli szabály nem', () => {
    const rules: IConditionalValue[] = [
      { value: 'félkész' },
      { when: { field: 'A', op: 'eq', value: 'x' }, value: 'első' },
      { when: { field: 'A', op: 'notEmpty' }, value: 'második' }
    ];
    expect(pickConditionalValue(rules, { A: 'x' })).toBe('első');
    expect(pickConditionalValue(rules, { A: 'y' })).toBe('második');
    expect(pickConditionalValue(rules, {})).toBeUndefined();
    expect(pickConditionalValue(undefined, {})).toBeUndefined();
  });

  it('setConditionalValues / countConditionalValues: az üres lista és az üres rész kimarad', () => {
    const rule: IConditionalValue = { when: { field: 'A', op: 'empty' }, value: 'x' };
    const withRules = setConditionalValues({ label: 'Cím' }, 'label', [rule, { value: 'félkész' }]);
    expect(withRules).toEqual({ label: 'Cím', conditional: { label: [rule, { value: 'félkész' }] } });
    expect(countConditionalValues(withRules, 'label')).toBe(1);
    expect(countConditionalValues(withRules, 'description')).toBe(0);
    expect(countConditionalValues(undefined, 'label')).toBe(0);
    expect(setConditionalValues(withRules, 'label', [])).toEqual({ label: 'Cím' });
  });

  it('parseConfig: a szabályok megmaradnak; hibás szerkezet vagy feltétel hibát ad', () => {
    const conditional = {
      label: [{ when: { field: '[IsNewMode]', op: 'eq', value: true }, value: 'Új cím' }, { value: 'félkész' }],
      ismeretlen: [{ value: 'x' }]
    };
    expect(load({ fields: { Title: { conditional } } }).fields.Title.conditional).toEqual({ label: conditional.label });
    expect(load({ fields: { Title: { conditional: { label: [] } } } }).fields.Title.conditional).toBeUndefined();
    expect(parseConfig(configJson({ fields: { Title: { conditional: [] } } })).error).toContain('fields.Title.conditional');
    expect(parseConfig(configJson({ fields: { Title: { conditional: { label: {} } } } })).error).toContain('conditional.label');
    expect(
      parseConfig(configJson({ fields: { Title: { conditional: { label: [{ when: { field: 'A', op: 'nope' }, value: 'x' }] } } } })).error
    ).toContain('conditional.label[0].when');
  });

  it('resolveForm: a címke, a leírás és a helykitöltő a feltétel szerint változik, egyébként az alapérték marad', () => {
    const config = load({
      sections,
      fields: {
        Title: {
          label: 'Megnevezés',
          placeholder: 'alap',
          conditional: {
            label: [
              { when: { field: '[IsDisplayMode]', op: 'eq', value: true }, value: 'Megnevezés (megtekintés)' },
              { when: { field: 'Category', op: 'eq', value: 'Informatika' }, value: 'Eszköz neve' }
            ],
            description: [{ when: { field: '[Group:5]', op: 'eq', value: true }, value: '' }],
            placeholder: [{ when: { field: 'Category', op: 'eq', value: 'Informatika' }, value: 'pl. laptop' }]
          }
        },
        Category: { conditional: { label: [{ when: { field: 'Title', op: 'notEmpty' }, value: '' }] } }
      }
    });
    const base = getField(resolveForm(schema, config, 'edit', {}), 'Title');
    expect([base.label, base.description, base.placeholder]).toEqual(['Megnevezés', 'séma leírás', 'alap']);

    const matched = getField(resolveForm(schema, config, 'edit', { Category: 'Informatika' }), 'Title');
    expect([matched.label, matched.placeholder]).toEqual(['Eszköz neve', 'pl. laptop']);
    // Több teljesülő szabálynál az első érvényes.
    expect(getField(resolveForm(schema, config, 'display', { Category: 'Informatika' }), 'Title').label).toBe('Megnevezés (megtekintés)');
    // Üres leírás: a szabály a séma leírását is eltünteti; üres címke helyett a mező címe látszik.
    expect(getField(resolveForm(schema, config, 'edit', {}, [5]), 'Title').description).toBe('');
    expect(getField(resolveForm(schema, config, 'edit', { Title: 'x' }), 'Category').label).toBe('Category');
    expect(collectGroupIds(config)).toEqual([5]);
  });

  it('getInitialValues: a feltételes kezdőérték a megnyitáskor érvényesül, típus szerint átalakítva', () => {
    const config = load({
      sections,
      fields: {
        Title: {
          defaultValue: 'alap',
          conditional: {
            defaultValue: [
              { when: { field: '[Group:5]', op: 'eq', value: true }, value: 'tag' },
              { when: { field: 'Category', op: 'eq', value: 'Irodaszer' }, value: 'irodaszer' }
            ]
          }
        },
        Owner: { conditional: { defaultValue: [{ when: { field: '[IsNewMode]', op: 'eq', value: true }, value: '[me]' }] } },
        Due: { defaultValue: '[today]', conditional: { defaultValue: [{ when: { field: '[Group:5]', op: 'eq', value: true }, value: '' }] } }
      }
    });
    const me = { loginName: 'anna@contoso.com', displayName: 'Kiss Anna' };
    const owner: string = JSON.stringify([{ Key: 'i:0#.f|membership|anna@contoso.com', DisplayText: 'Kiss Anna' }]);
    // Nem tag: a séma kezdőértékére (Category) épülő szabály érvényes.
    expect(getInitialValues(schema, config, 'hu-HU', now, me)).toEqual({
      Title: 'irodaszer',
      Category: 'Irodaszer',
      Owner: owner,
      Due: '2026. 10. 11.'
    });
    // Tag: az első szabály érvényes; az üres érték a kezdőértéket törli.
    expect(getInitialValues(schema, config, 'hu-HU', now, me, [5])).toEqual({ Title: 'tag', Category: 'Irodaszer', Owner: owner });
  });
});
