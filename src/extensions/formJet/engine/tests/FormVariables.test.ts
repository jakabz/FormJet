import { IFieldSchema } from '../../models/IFieldSchema';
import { IFormConfig, IFormVariable } from '../../models/IFormConfig';
import { applyConditionToFields, combineConditions } from '../BulkConditions';
import { collectGroupIds } from '../ConditionContext';
import {
  applyTransform,
  evaluateVariables,
  isVariableName,
  newVariableName,
  parseVariableRef,
  renameVariable,
  variableOrder,
  variableRef
} from '../FormVariables';
import { parseConfig, resolveForm } from '../LayoutResolver';
import { configJson, field, getField } from './helpers';

function load(patch: Record<string, unknown>): IFormConfig {
  const result = parseConfig(configJson(patch));
  if (!result.config) {
    throw new Error(result.error);
  }
  return result.config;
}

/** A képen szereplő szabályok: a StatusNumber a mentett Status első két karaktere számként. */
const VARIABLES: Record<string, IFormVariable> = {
  StatusNumber: { kind: 'value', field: 'Status', saved: true, transforms: [{ type: 'substring', start: 0, length: 2 }, { type: 'number' }] },
  HideLogistics: {
    kind: 'condition',
    when: { any: [{ field: '[IsNewMode]', op: 'eq', value: true }, { field: '[Var:StatusNumber]', op: 'eq', value: 1 }] }
  },
  NotNew: { kind: 'condition', when: { field: '[Var:StatusNumber]', op: 'gt', value: 1 } },
  LockHeader: {
    kind: 'condition',
    when: {
      all: [
        { field: 'Status', op: 'ne', value: '01. SAL - Placing customer order' },
        { field: '[IsNewMode]', op: 'eq', value: false },
        { field: '[Group:7]', op: 'eq', value: false }
      ]
    }
  },
  SavedCountry: { kind: 'value', field: 'Country', saved: true, transforms: [{ type: 'upper' }] }
};

describe('FormVariables – változók', () => {
  const schema: IFieldSchema[] = [field('Status', 'Choice'), field('Country', 'Text'), field('Logistics', 'Text')];

  it('a változó neve és hivatkozása', () => {
    expect(isVariableName('StatusNumber')).toBe(true);
    expect(isVariableName('Status_2')).toBe(true);
    expect(isVariableName('2Status')).toBe(false);
    expect(isVariableName('Status Number')).toBe(false);
    expect(variableRef('X')).toBe('[Var:X]');
    expect(parseVariableRef('[Var:X]')).toBe('X');
    expect(parseVariableRef('X')).toBeUndefined();
    expect(newVariableName(load({ variables: { Variable2: { kind: 'condition' } } }), 'Variable')).toBe('Variable3');
  });

  it('applyTransform: szövegrész, szám, kis- és nagybetű, szóközök', () => {
    expect(applyTransform('02. LOG - Shipping', { type: 'substring', start: 0, length: 2 })).toBe('02');
    expect(applyTransform('abc', { type: 'substring', start: 1 })).toBe('bc');
    expect(applyTransform('abc', { type: 'substring', start: 5, length: 2 })).toBe('');
    expect(applyTransform('02', { type: 'number' })).toBe('2');
    expect(applyTransform('1 234,5', { type: 'number' })).toBe('1234.5');
    expect(applyTransform('xx', { type: 'number' })).toBe('');
    expect(applyTransform(' a ', { type: 'trim' })).toBe('a');
    expect(applyTransform('Slovakia', { type: 'upper' })).toBe('SLOVAKIA');
    expect(applyTransform('Slovakia', { type: 'lower' })).toBe('slovakia');
  });

  it('evaluateVariables: függőségi sorrendben; mentett és élő forrás; feltétel nélkül nem', () => {
    const values = { Status: '05. FIN - Invoice', '[IsNewMode]': '0', '[Group:7]': '0', Country: 'Hungary' };
    const saved = { Status: '01. SAL - Placing customer order', Country: 'Slovakia' };
    expect(evaluateVariables({ ...VARIABLES, Empty: { kind: 'condition' } }, values, saved)).toEqual({
      '[Var:StatusNumber]': '1',
      '[Var:HideLogistics]': '1',
      '[Var:NotNew]': '0',
      '[Var:LockHeader]': '1',
      '[Var:SavedCountry]': 'SLOVAKIA',
      '[Var:Empty]': '0'
    });
    expect(evaluateVariables(undefined, values, saved)).toEqual({});
  });

  it('variableOrder: a körkörös hivatkozás (és ami rá épül) nem / üres értéket kap', () => {
    const cyclic: Record<string, IFormVariable> = {
      A: { kind: 'condition', when: { field: '[Var:B]', op: 'eq', value: true } },
      B: { kind: 'condition', when: { field: '[Var:A]', op: 'eq', value: true } },
      C: { kind: 'condition', when: { field: '[Var:A]', op: 'ne', value: true } },
      D: { kind: 'condition', when: { field: '[Var:Missing]', op: 'empty' } }
    };
    const { order, cyclic: broken } = variableOrder(cyclic);
    expect(order).toEqual(['D']);
    expect(broken.sort()).toEqual(['A', 'B', 'C']);
    expect(evaluateVariables(cyclic, {}, {})).toEqual({ '[Var:A]': '0', '[Var:B]': '0', '[Var:C]': '0', '[Var:D]': '1' });
  });

  it('resolveForm: a változóra épülő láthatóság és letiltás; a csoport a változón át is lekérdeződik', () => {
    const config = load({
      sections: [
        { id: 'log', columns: 1, visibleWhen: { field: '[Var:HideLogistics]', op: 'eq', value: false }, fields: [{ field: 'Logistics' }] },
        { id: 'head', columns: 1, fields: [{ field: 'Status' }, { field: 'Country' }] }
      ],
      fields: { Country: { readOnlyWhen: { field: '[Var:LockHeader]', op: 'eq', value: true } } },
      variables: VARIABLES
    });
    expect(collectGroupIds(config)).toEqual([7]);
    const saved = { Status: '03. LOG - Delivery', Country: 'Hungary' };
    const edit = resolveForm(schema, config, 'edit', { Status: '03. LOG - Delivery' }, [], false, saved);
    expect(edit.sections[0].visible).toBe(true);
    expect(getField(edit, 'Country').readOnly).toBe(true);
    // A csoport tagja szerkesztheti a fejlécet.
    expect(getField(resolveForm(schema, config, 'edit', { Status: '03. LOG' }, [7], false, saved), 'Country').readOnly).toBe(false);
    // Új elemnél és 01-es (mentett) státusznál a logisztikai szekció rejtett.
    expect(resolveForm(schema, config, 'new', {}).sections[0].visible).toBe(false);
    expect(resolveForm(schema, config, 'edit', {}, [], false, { Status: '01. SAL' }).sections[0].visible).toBe(false);
  });

  it('parseConfig: a változók megmaradnak; hibás név, fajta, mező vagy átalakítás hibát ad', () => {
    expect(load({ variables: VARIABLES }).variables).toEqual(VARIABLES);
    expect(load({ variables: { Half: { kind: 'value', field: '', transforms: [] } } }).variables).toEqual({ Half: { kind: 'value' } });
    expect(parseConfig(configJson({ variables: { '2x': { kind: 'condition' } } })).error).toContain('variables.2x');
    expect(parseConfig(configJson({ variables: { X: { kind: 'formula' } } })).error).toContain('variables.X');
    expect(parseConfig(configJson({ variables: { X: { kind: 'value', field: 'a b' } } })).error).toContain('variables.X.field');
    expect(parseConfig(configJson({ variables: { X: { kind: 'value', transforms: [{ type: 'eval' }] } } })).error).toContain(
      'variables.X.transforms[0].type'
    );
    expect(parseConfig(configJson({ variables: { X: { kind: 'condition', when: { field: 'A', op: 'x' } } } })).error).toContain(
      'variables.X.when'
    );
  });

  it('renameVariable: az átnevezés minden hivatkozást követ; foglalt névre nem nevez át', () => {
    const config = load({
      sections: [{ id: 's', columns: 1, visibleWhen: { field: '[Var:NotNew]', op: 'eq', value: true }, fields: [] }],
      fields: {
        A: {
          readOnlyWhen: { all: [{ field: '[Var:NotNew]', op: 'eq', value: true }, { field: 'B', op: 'empty' }] },
          conditional: { label: [{ when: { not: { field: '[Var:NotNew]', op: 'eq', value: true } }, value: 'x' }] }
        }
      },
      variables: { NotNew: VARIABLES.NotNew, StatusNumber: VARIABLES.StatusNumber, Uses: { kind: 'condition', when: { field: '[Var:NotNew]', op: 'eq', value: true } } }
    });
    const renamed = renameVariable(config, 'NotNew', 'AfterFirst');
    expect(Object.keys(renamed.variables ?? {})).toEqual(['AfterFirst', 'StatusNumber', 'Uses']);
    const text: string = JSON.stringify(renamed);
    expect(text).not.toContain('[Var:NotNew]');
    expect(text.split('[Var:AfterFirst]').length - 1).toBe(4);
    expect(renameVariable(config, 'NotNew', 'StatusNumber')).toBe(config);
  });
});

describe('BulkConditions – feltétel több mezőre', () => {
  const rule = { field: '[Var:HideLogistics]', op: 'eq' as const, value: false };

  it('combineConditions: az azonos fajta csoportot kiteríti', () => {
    expect(combineConditions(undefined, rule, 'all')).toEqual(rule);
    const other = { field: 'A', op: 'empty' as const };
    expect(combineConditions(other, rule, 'all')).toEqual({ all: [other, rule] });
    expect(combineConditions({ all: [other, other] }, rule, 'all')).toEqual({ all: [other, other, rule] });
    expect(combineConditions({ all: [other] }, rule, 'any')).toEqual({ any: [{ all: [other] }, rule] });
  });

  it('applyConditionToFields: felülír, kiegészít, töröl; a többi beállítás megmarad', () => {
    const config = load({ fields: { A: { label: 'Á', visibleWhen: { field: 'X', op: 'empty' } } } });
    const replaced = applyConditionToFields(config, ['A', 'B'], 'visibleWhen', rule, 'replace');
    expect(replaced.fields.A).toEqual({ label: 'Á', visibleWhen: rule });
    expect(replaced.fields.B).toEqual({ visibleWhen: rule });
    const anded = applyConditionToFields(config, ['A'], 'visibleWhen', rule, 'and');
    expect(anded.fields.A.visibleWhen).toEqual({ all: [{ field: 'X', op: 'empty' }, rule] });
    const ored = applyConditionToFields(config, ['A'], 'readOnlyWhen', rule, 'or');
    expect(ored.fields.A.readOnlyWhen).toEqual(rule);
    expect(applyConditionToFields(config, ['A'], 'visibleWhen', undefined, 'clear').fields.A).toEqual({ label: 'Á' });
    expect(applyConditionToFields(config, ['A'], 'visibleWhen', undefined, 'replace')).toBe(config);
  });
});
