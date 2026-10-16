import { Condition } from '../../models/IFormConfig';
import {
  changeRowOperator,
  createEmptyGroup,
  createEmptyRow,
  fromConditionRows,
  IConditionRow,
  isConditionGroup,
  operatorNeedsValue,
  rowToCondition,
  splitValues,
  toConditionRows
} from '../ConditionModel';

const TYPES: Record<string, string> = { Amount: 'Currency', Urgent: 'Boolean', Title: 'Text', Status: 'Choice' };
const typeOf = (field: string): string | undefined => TYPES[field];

function roundTrip(condition: Condition | undefined): Condition | undefined {
  const rows = toConditionRows(condition);
  return rows ? fromConditionRows(rows, typeOf) : undefined;
}

function row(patch: Partial<IConditionRow>): IConditionRow {
  return { ...createEmptyRow(), ...patch };
}

describe('ConditionModel', () => {
  describe('toConditionRows', () => {
    it('hiányzó feltételre üres sorlista', () => {
      expect(toConditionRows(undefined)).toEqual({ match: 'all', rows: [] });
    });

    it('egyetlen mezőfeltétel egy sor', () => {
      expect(toConditionRows({ field: 'Amount', op: 'gt', value: 500000 })).toEqual({
        match: 'all',
        rows: [{ field: 'Amount', op: 'gt', text: '500000', values: [], raw: 500000 }]
      });
    });

    it('all / any csoport sorokként, az `in` értékei külön', () => {
      const rows = toConditionRows({ any: [{ field: 'Status', op: 'in', value: ['A', 'B'] }, { field: 'Title', op: 'empty' }] });
      expect(rows?.match).toBe('any');
      expect(rows?.rows[0]).toEqual({ field: 'Status', op: 'in', text: 'A, B', values: ['A', 'B'], raw: ['A', 'B'] });
      expect(rows?.rows[1]).toEqual({ field: 'Title', op: 'empty', text: '', values: [], raw: undefined });
    });

    it('a `not` vizuálisan nem szerkeszthető, bárhol is van', () => {
      expect(toConditionRows({ not: { field: 'A', op: 'empty' } })).toBeUndefined();
      expect(toConditionRows({ all: [{ not: { field: 'A', op: 'empty' } }] })).toBeUndefined();
      expect(toConditionRows({ all: [{ field: 'A', op: 'empty' }, { any: [{ not: { field: 'B', op: 'empty' } }] }] })).toBeUndefined();
    });

    it('a beágyazott csoport csoport-elemként jelenik meg', () => {
      const rows = toConditionRows({ all: [{ field: 'A', op: 'empty' }, { any: [{ field: 'B', op: 'empty' }, { field: 'C', op: 'notEmpty' }] }] });
      expect(rows?.match).toBe('all');
      expect(rows?.rows).toHaveLength(2);
      const group = rows?.rows[1];
      expect(group && isConditionGroup(group) ? [group.match, group.rows.length] : undefined).toEqual(['any', 2]);
    });
  });

  describe('oda-vissza alakítás', () => {
    it('a nem szerkesztett feltétel változatlan marad, az értékek típusával együtt', () => {
      const conditions: Condition[] = [
        { field: 'Amount', op: 'gt', value: 500000 },
        { field: 'Title', op: 'eq', value: 5 },
        { field: 'Urgent', op: 'eq', value: true },
        { field: 'Title', op: 'notEmpty' },
        { all: [{ field: 'Amount', op: 'lt', value: '1 000' }, { field: 'Status', op: 'in', value: ['A', 2] }] },
        { any: [{ field: 'Title', op: 'contains', value: 'x' }, { field: 'Title', op: 'empty' }] },
        // A képen szereplő országos csoportszabály szerkezete: VAGY-csoportban ÉS-csoportok, bennük VAGY-csoport.
        {
          any: [
            {
              all: [
                { any: [{ field: '[Group:3]', op: 'eq', value: true }, { field: '[Group:4]', op: 'eq', value: true }] },
                { field: '[Var:SavedCountry]', op: 'eq', value: 'ALBANIA' }
              ]
            },
            {
              all: [
                { any: [{ field: '[Group:5]', op: 'eq', value: true }, { field: '[Group:6]', op: 'eq', value: true }] },
                { field: 'Country', op: 'eq', value: 'BOSNIA-HERZEGOVINA' }
              ]
            }
          ]
        }
      ];
      conditions.forEach((condition) => expect(roundTrip(condition)).toEqual(condition));
    });

    it('egyelemű csoportból önálló mezőfeltétel lesz', () => {
      expect(roundTrip({ all: [{ field: 'Title', op: 'empty' }] })).toEqual({ field: 'Title', op: 'empty' });
    });

    it('üres csoportból és hiányzó feltételből nincs feltétel', () => {
      expect(roundTrip({ all: [] })).toBeUndefined();
      expect(roundTrip(undefined)).toBeUndefined();
    });
  });

  describe('rowToCondition', () => {
    it('félkész sor: nincs mező, vagy hiányzik az érték', () => {
      expect(rowToCondition(row({ op: 'eq', text: 'x' }), undefined)).toBeUndefined();
      expect(rowToCondition(row({ field: 'Title', op: 'eq', text: '  ' }), 'Text')).toBeUndefined();
      expect(rowToCondition(row({ field: 'Status', op: 'in' }), 'Choice')).toBeUndefined();
    });

    it('érték nélküli operátoroknál az érték kimarad', () => {
      expect(rowToCondition(row({ field: 'Title', op: 'empty', text: 'maradék' }), 'Text')).toEqual({ field: 'Title', op: 'empty' });
      expect(operatorNeedsValue('notEmpty')).toBe(false);
      expect(operatorNeedsValue('eq')).toBe(true);
    });

    it('szám mezőnél és összehasonlításnál a tiszta szám számként kerül a feltételbe', () => {
      expect(rowToCondition(row({ field: 'Amount', op: 'eq', text: '500000' }), 'Currency')).toEqual({ field: 'Amount', op: 'eq', value: 500000 });
      expect(rowToCondition(row({ field: 'Title', op: 'gt', text: '10.5' }), 'Text')).toEqual({ field: 'Title', op: 'gt', value: 10.5 });
      // A tagolt vagy tizedesvesszős szám szöveg marad; a motor kiértékeléskor értelmezi.
      expect(rowToCondition(row({ field: 'Amount', op: 'gt', text: '500 000' }), 'Currency')).toEqual({ field: 'Amount', op: 'gt', value: '500 000' });
      expect(rowToCondition(row({ field: 'Title', op: 'eq', text: '42' }), 'Text')).toEqual({ field: 'Title', op: 'eq', value: '42' });
    });

    it('igen/nem mezőnél logikai érték', () => {
      expect(rowToCondition(row({ field: 'Urgent', op: 'eq', text: 'true' }), 'Boolean')).toEqual({ field: 'Urgent', op: 'eq', value: true });
      expect(rowToCondition(row({ field: 'Urgent', op: 'ne', text: 'false' }), 'Boolean')).toEqual({ field: 'Urgent', op: 'ne', value: false });
    });

    it('`in`: a kiválasztott értékekből vagy a vesszővel elválasztott szövegből', () => {
      expect(rowToCondition(row({ field: 'Status', op: 'in', values: ['A', 'B, C'] }), 'Choice')).toEqual({ field: 'Status', op: 'in', value: ['A', 'B, C'] });
      expect(rowToCondition(row({ field: 'Title', op: 'in', text: ' a, b ,, c ' }), 'Text')).toEqual({ field: 'Title', op: 'in', value: ['a', 'b', 'c'] });
      expect(rowToCondition(row({ field: 'Amount', op: 'in', text: '1, 2' }), 'Currency')).toEqual({ field: 'Amount', op: 'in', value: [1, 2] });
    });
  });

  describe('fromConditionRows', () => {
    it('a félkész sorok kimaradnak; a csoport típusa a beállítás szerinti', () => {
      const rows = [row({ field: 'Title', op: 'notEmpty' }), row({}), row({ field: 'Amount', op: 'gt', text: '5' })];
      expect(fromConditionRows({ match: 'any', rows }, typeOf)).toEqual({
        any: [{ field: 'Title', op: 'notEmpty' }, { field: 'Amount', op: 'gt', value: 5 }]
      });
      expect(fromConditionRows({ match: 'all', rows: [row({})] }, typeOf)).toBeUndefined();
    });
  });

  describe('changeRowOperator', () => {
    it('skalár operátorok között az érték és a típusa megmarad', () => {
      const changed = changeRowOperator(row({ field: 'Amount', op: 'gt', text: '5', raw: 5 }), 'lt');
      expect(changed).toEqual({ field: 'Amount', op: 'lt', text: '5', values: [], raw: 5 });
    });

    it('`in`-re váltva az értékből lista lesz, visszaváltva az első elem marad', () => {
      const toIn = changeRowOperator(row({ field: 'Title', op: 'eq', text: 'a, b', raw: 'a, b' }), 'in');
      expect(toIn).toEqual({ field: 'Title', op: 'in', text: 'a, b', values: ['a', 'b'] });
      expect(changeRowOperator(toIn, 'eq')).toEqual({ field: 'Title', op: 'eq', text: 'a', values: [] });
    });

    it('azonos operátornál ugyanaz a sor', () => {
      const original = row({ field: 'Title', op: 'eq', text: 'x' });
      expect(changeRowOperator(original, 'eq')).toBe(original);
    });
  });

  it('splitValues', () => {
    expect(splitValues(' a, b ,, c ')).toEqual(['a', 'b', 'c']);
    expect(splitValues('')).toEqual([]);
  });
});

describe('ConditionModel – beágyazott csoportok', () => {
  const typeOfNested = (field: string): string | undefined => (field.indexOf('[Group:') === 0 ? 'Boolean' : 'Text');

  it('a csoportból feltétel lesz; az üres csoport és a félkész sor kimarad, az egyelemű csoport kiterül', () => {
    const condition = fromConditionRows(
      {
        match: 'any',
        rows: [
          {
            kind: 'group',
            match: 'all',
            rows: [
              { kind: 'group', match: 'any', rows: [{ ...createEmptyRow(), field: '[Group:3]', text: 'true' }, createEmptyRow()] },
              { ...createEmptyRow(), field: 'Country', text: 'ALBANIA' }
            ]
          },
          createEmptyGroup(),
          { ...createEmptyRow(), field: 'Title', op: 'notEmpty' }
        ]
      },
      typeOfNested
    );
    expect(condition).toEqual({
      any: [
        { all: [{ field: '[Group:3]', op: 'eq', value: true }, { field: 'Country', op: 'eq', value: 'ALBANIA' }] },
        { field: 'Title', op: 'notEmpty' }
      ]
    });
  });

  it('createEmptyGroup: üres sorral, alapból VAGY kapcsolattal', () => {
    const group = createEmptyGroup();
    expect([group.kind, group.match, group.rows.length]).toEqual(['group', 'any', 1]);
    expect(createEmptyGroup('all').match).toBe('all');
  });
});
