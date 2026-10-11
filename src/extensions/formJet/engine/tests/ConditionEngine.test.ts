import { Condition } from '../../models/IFormConfig';
import {
  evaluate,
  isEmptyValue,
  joinMultiValue,
  parseNumber,
  splitMultiValue,
  validateCondition
} from '../ConditionEngine';

describe('ConditionEngine', () => {
  describe('evaluate', () => {
    it('hiányzó feltétel mindig igaz', () => {
      expect(evaluate(undefined, {})).toBe(true);
    });

    it('eq / ne: kis- és nagybetűtől független, a logikai érték az 1/0-val egyezik', () => {
      expect(evaluate({ field: 'a', op: 'eq', value: 'ABC' }, { a: 'abc' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'eq', value: true }, { a: '1' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'eq', value: false }, { a: '0' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'ne', value: false }, { a: '1' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'eq', value: 5 }, { a: '5' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'ne', value: 'x' }, { a: 'x' })).toBe(false);
    });

    it('gt / lt: szóközzel tagolt és tizedesvesszős számot is kezel', () => {
      expect(evaluate({ field: 'a', op: 'gt', value: 1000 }, { a: '1 234,5' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'lt', value: '2' }, { a: '1,5' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'gt', value: 500000 }, { a: '500000' })).toBe(false);
    });

    it('gt / lt: nem szám vagy hiányzó érték esetén hamis', () => {
      expect(evaluate({ field: 'a', op: 'gt', value: 1 }, { a: 'abc' })).toBe(false);
      expect(evaluate({ field: 'a', op: 'gt', value: 1 }, {})).toBe(false);
      expect(evaluate({ field: 'a', op: 'lt', value: 1 }, {})).toBe(false);
    });

    it('contains: több értékű mezőnél elemre, egyébként szövegrészre vizsgál', () => {
      expect(evaluate({ field: 'a', op: 'contains', value: 'B' }, { a: ';#A;#B;#' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'contains', value: 'A' }, { a: ';#AB;#C;#' })).toBe(false);
      expect(evaluate({ field: 'a', op: 'contains', value: 'ELL' }, { a: 'Hello' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'contains', value: '6' }, { a: '5;#;#6;#' })).toBe(true);
    });

    it('in: a lista bármely elemének egyezése elég', () => {
      expect(evaluate({ field: 'a', op: 'in', value: ['x', 'B'] }, { a: ';#A;#B;#' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'in', value: ['x'] }, { a: 'X' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'in', value: ['y'] }, { a: 'x' })).toBe(false);
      expect(evaluate({ field: 'a', op: 'in', value: [9, 5] }, { a: '5;#;#6;#' })).toBe(true);
    });

    it('empty / notEmpty', () => {
      expect(evaluate({ field: 'a', op: 'empty' }, {})).toBe(true);
      expect(evaluate({ field: 'a', op: 'empty' }, { a: '  ' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'empty' }, { a: '[]' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'notEmpty' }, { a: '0' })).toBe(true);
      expect(evaluate({ field: 'a', op: 'notEmpty' }, { a: '' })).toBe(false);
    });

    it('all / any / not kombinációk', () => {
      const all: Condition = { all: [{ field: 'a', op: 'eq', value: 1 }, { not: { field: 'b', op: 'notEmpty' } }] };
      expect(evaluate(all, { a: '1' })).toBe(true);
      expect(evaluate(all, { a: '1', b: 'x' })).toBe(false);
      const any: Condition = { any: [{ field: 'a', op: 'eq', value: 2 }, { field: 'a', op: 'eq', value: 1 }] };
      expect(evaluate(any, { a: '1' })).toBe(true);
      expect(evaluate(any, { a: '3' })).toBe(false);
      expect(evaluate({ any: [] }, {})).toBe(false);
      expect(evaluate({ all: [] }, {})).toBe(true);
    });
  });

  describe('validateCondition', () => {
    it('érvényes feltételre nincs hiba', () => {
      expect(validateCondition({ field: 'A', op: 'gt', value: 5 })).toBeUndefined();
      expect(validateCondition({ all: [{ field: 'A', op: 'empty' }, { not: { field: 'B', op: 'in', value: ['x'] } }] })).toBeUndefined();
    });

    it('hibás feltételre hibaüzenetet ad', () => {
      expect(validateCondition('x')).toBeDefined();
      expect(validateCondition({ field: 'A', op: 'like', value: 1 })).toBeDefined();
      expect(validateCondition({ op: 'eq', value: 1 })).toBeDefined();
      expect(validateCondition({ field: 'A', op: 'in', value: 'x' })).toBeDefined();
      expect(validateCondition({ field: 'A', op: 'eq', value: { a: 1 } })).toBeDefined();
      expect(validateCondition({ all: 'x' })).toBeDefined();
    });

    it('a hibaüzenetben szerepel a megadott útvonal', () => {
      expect(validateCondition({ field: 'A', op: 'like' }, 'fields.A.visibleWhen')).toContain('fields.A.visibleWhen');
    });
  });

  describe('segédfüggvények', () => {
    it('splitMultiValue / joinMultiValue oda-vissza', () => {
      expect(splitMultiValue(';#A;#B;#')).toEqual(['A', 'B']);
      expect(splitMultiValue('A')).toEqual(['A']);
      expect(splitMultiValue('')).toEqual([]);
      expect(splitMultiValue(undefined)).toEqual([]);
      expect(joinMultiValue(['A', 'B'])).toBe(';#A;#B;#');
      expect(joinMultiValue([])).toBe('');
      expect(joinMultiValue(splitMultiValue(';#A;#B;#'))).toBe(';#A;#B;#');
    });

    it('isEmptyValue', () => {
      expect(isEmptyValue(undefined)).toBe(true);
      expect(isEmptyValue('')).toBe(true);
      expect(isEmptyValue('   ')).toBe(true);
      expect(isEmptyValue('[]')).toBe(true);
      expect(isEmptyValue(';#;#')).toBe(true);
      expect(isEmptyValue('0')).toBe(false);
      expect(isEmptyValue(';#A;#')).toBe(false);
    });

    it('parseNumber', () => {
      expect(parseNumber(12)).toBe(12);
      expect(parseNumber('1 234,5')).toBe(1234.5);
      expect(parseNumber('600 000')).toBe(600000);
      expect(parseNumber('-3,5')).toBe(-3.5);
      expect(isNaN(parseNumber('abc'))).toBe(true);
      expect(isNaN(parseNumber(undefined))).toBe(true);
      expect(isNaN(parseNumber(true))).toBe(true);
    });
  });
});
