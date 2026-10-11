import { IFormConfig } from '../../models/IFormConfig';
import { addFieldToSection, findFieldSection, moveFieldToSection, moveSection, reorderField } from '../LayoutMoves';

const config: IFormConfig = {
  schemaVersion: 1,
  listId: '',
  contentTypeId: '',
  sections: [
    { id: 'a', columns: 3, fields: [{ field: 'A1' }, { field: 'A2', colSpan: 3 }, { field: 'A3' }] },
    { id: 'b', columns: 2, fields: [{ field: 'B1' }, { field: 'B2' }] },
    { id: 'c', columns: 1, fields: [] }
  ],
  fields: {}
};

function layout(value: IFormConfig): string {
  return value.sections.map((section) => `${section.id}:${section.fields.map((placement) => placement.field).join(',')}`).join(' | ');
}

describe('LayoutMoves', () => {
  it('findFieldSection', () => {
    expect(findFieldSection(config, 'A2')).toBe('a');
    expect(findFieldSection(config, 'B2')).toBe('b');
    expect(findFieldSection(config, 'Nope')).toBeUndefined();
  });

  it('moveSection: a szekció a másik helyére kerül', () => {
    expect(layout(moveSection(config, 'a', 'c'))).toBe('b:B1,B2 | c: | a:A1,A2,A3');
    expect(layout(moveSection(config, 'c', 'a'))).toBe('c: | a:A1,A2,A3 | b:B1,B2');
  });

  it('moveSection: ismeretlen vagy azonos szekciónál nem változik', () => {
    expect(moveSection(config, 'a', 'a')).toBe(config);
    expect(moveSection(config, 'a', 'x')).toBe(config);
    expect(moveSection(config, 'x', 'a')).toBe(config);
  });

  it('reorderField: szekción belül előre és hátra', () => {
    expect(layout(reorderField(config, 'A1', 'A3'))).toBe('a:A2,A3,A1 | b:B1,B2 | c:');
    expect(layout(reorderField(config, 'A3', 'A1'))).toBe('a:A3,A1,A2 | b:B1,B2 | c:');
  });

  it('reorderField: másik szekció mezőjére, önmagára vagy ismeretlen mezőre nem változik', () => {
    expect(reorderField(config, 'A1', 'B1')).toBe(config);
    expect(reorderField(config, 'A1', 'A1')).toBe(config);
    expect(reorderField(config, 'Nope', 'A1')).toBe(config);
  });

  it('moveFieldToSection: megadott mező elé, illetve a szekció végére', () => {
    expect(layout(moveFieldToSection(config, 'A1', 'b', 'B2'))).toBe('a:A2,A3 | b:B1,A1,B2 | c:');
    expect(layout(moveFieldToSection(config, 'A1', 'b'))).toBe('a:A2,A3 | b:B1,B2,A1 | c:');
    expect(layout(moveFieldToSection(config, 'B1', 'c'))).toBe('a:A1,A2,A3 | b:B2 | c:B1');
  });

  it('moveFieldToSection: a szélesség a célszekció oszlopszámához igazodik, a többi beállítás megmarad', () => {
    const moved = moveFieldToSection(config, 'A2', 'b');
    expect(moved.sections[1].fields[2]).toEqual({ field: 'A2', colSpan: 2 });
    expect(moveFieldToSection(config, 'A2', 'c').sections[2].fields[0]).toEqual({ field: 'A2', colSpan: 1 });
  });

  it('moveFieldToSection: azonos szekcióba, ismeretlen szekcióba vagy ismeretlen mezővel nem változik', () => {
    expect(moveFieldToSection(config, 'A1', 'a')).toBe(config);
    expect(moveFieldToSection(config, 'A1', 'x')).toBe(config);
    expect(moveFieldToSection(config, 'Nope', 'b')).toBe(config);
  });

  it('addFieldToSection: megadott mező elé, a szekció végére és üres szekcióba', () => {
    expect(layout(addFieldToSection(config, 'New', 'a', 'A2'))).toBe('a:A1,New,A2,A3 | b:B1,B2 | c:');
    expect(layout(addFieldToSection(config, 'New', 'b'))).toBe('a:A1,A2,A3 | b:B1,B2,New | c:');
    expect(layout(addFieldToSection(config, 'New', 'c'))).toBe('a:A1,A2,A3 | b:B1,B2 | c:New');
    // Ismeretlen „elé” mezőnél a szekció végére kerül.
    expect(layout(addFieldToSection(config, 'New', 'b', 'A1'))).toBe('a:A1,A2,A3 | b:B1,B2,New | c:');
  });

  it('addFieldToSection: már elhelyezett mezővel vagy ismeretlen szekcióval nem változik', () => {
    expect(addFieldToSection(config, 'A1', 'b')).toBe(config);
    expect(addFieldToSection(config, 'New', 'x')).toBe(config);
  });

  it('az eredeti konfiguráció nem módosul', () => {
    addFieldToSection(config, 'New', 'a', 'A2');
    const before: string = JSON.stringify(config);
    moveSection(config, 'a', 'c');
    reorderField(config, 'A1', 'A3');
    moveFieldToSection(config, 'A2', 'b', 'B1');
    expect(JSON.stringify(config)).toBe(before);
  });
});
