import { IListCommand } from '../../models/IListCommands';
import {
  collectCommandGroupIds,
  isActionComplete,
  isCommandVisible,
  newCommandId,
  parseListCommands,
  resolveTemplate,
  templateFields
} from '../ListCommands';

const LIST_A: string = '11111111-2222-3333-4444-555555555555';
const LIST_B: string = 'AAAAAAAA-2222-3333-4444-555555555555';

function raw(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({ schemaVersion: 1, listId: LIST_A, commands: [], ...patch });
}

describe('ListCommands – a lista helyi menüjének menüpontjai', () => {
  it('parseListCommands: érvényes menüpontok; a lista azonosítója kisbetűs; a félkész lépés megmarad', () => {
    const result = parseListCommands(
      raw({
        commands: [
          {
            id: 'cmd:1',
            title: 'Jóváhagyás',
            confirm: 'Biztos?',
            visibleWhen: { field: 'Status', op: 'eq', value: 'Draft' },
            actions: [
              { type: 'setValue', field: 'Status', value: 'Approved' },
              { type: 'updateItems', listId: LIST_B, matchField: 'OrderRef', sourceField: 'ID', values: [{ field: 'State', value: '{Status}' }] },
              { type: 'createItem', listId: LIST_B, values: [{ field: 'Title', value: 'Új: {Title}' }, { field: '', value: 'x' }] },
              { type: 'createItem' }
            ]
          }
        ]
      })
    );
    expect(result.error).toBeUndefined();
    const command = result.config?.commands[0] as IListCommand;
    expect(command.actions[1]).toEqual({
      type: 'updateItems',
      listId: LIST_B.toLowerCase(),
      matchField: 'OrderRef',
      sourceField: 'ID',
      values: [{ field: 'State', value: '{Status}' }]
    });
    expect(command.actions[3]).toEqual({ type: 'createItem', listId: '', values: [] });
    expect(command.actions.map(isActionComplete)).toEqual([true, true, true, false]);
  });

  it('parseListCommands: az ikon csak érvényes Fluent ikonnév lehet, egyébként elmarad', () => {
    const result = parseListCommands(
      raw({ commands: [{ title: 'a', icon: 'CheckMark' }, { title: 'b', icon: 'url(x)' }, { title: 'c', icon: '' }, { title: 'd' }] })
    );
    expect(result.config?.commands.map((command) => command.icon)).toEqual(['CheckMark', undefined, undefined, undefined]);
  });

  it('parseListCommands: hibás szerkezet, ismeretlen lépés, hibás lista vagy mezőnév hibát ad; legfeljebb 10 menüpont', () => {
    expect(parseListCommands('{nope').error).toBeDefined();
    expect(parseListCommands(raw({ schemaVersion: 2 })).error).toBeDefined();
    expect(parseListCommands(raw({ commands: {} })).error).toContain('commands');
    expect(parseListCommands(raw({ commands: [{ title: 'x', actions: [{ type: 'runScript' }] }] })).error).toContain('commands[0].actions[0].type');
    expect(parseListCommands(raw({ commands: [{ title: 'x', actions: [{ type: 'createItem', listId: 'lista' }] }] })).error).toContain('listId');
    expect(parseListCommands(raw({ commands: [{ title: 'x', actions: [{ type: 'setValue', field: 'a b' }] }] })).error).toContain('field');
    const many = parseListCommands(raw({ commands: Array.from({ length: 12 }, (_, i) => ({ title: `M${i}` })) }));
    expect(many.config?.commands).toHaveLength(10);
  });

  it('resolveTemplate: a teljes hivatkozás változatlanul, a szövegbe ágyazott szövegként helyettesítődik', () => {
    const source = { Title: 'Szerszám', Owner: '[{"Key":"i:0#.f|membership|anna@contoso.com"}]', Due: '2026. 10. 27.' };
    expect(resolveTemplate('{Owner}', source)).toBe(source.Owner);
    expect(resolveTemplate(' {Due} ', source)).toBe('2026. 10. 27.');
    expect(resolveTemplate('Új: {Title} ({Missing})', source)).toBe('Új: Szerszám ()');
    expect(resolveTemplate('[today]', source)).toBe('[today]');
    expect(templateFields('{Title} – {Due}, {Title}')).toEqual(['Title', 'Due']);
  });

  it('isCommandVisible: a kijelölt elem értékei, a csoporttagság és a létrehozó szerint', () => {
    const command: IListCommand = {
      id: 'cmd:1',
      title: 'x',
      actions: [],
      visibleWhen: {
        all: [
          { field: 'Status', op: 'eq', value: 'Draft' },
          { any: [{ field: '[Group:5]', op: 'eq', value: true }, { field: '[IsAuthor]', op: 'eq', value: true }] }
        ]
      }
    };
    expect(isCommandVisible(command, { Status: 'Draft' }, [5], false)).toBe(true);
    expect(isCommandVisible(command, { Status: 'Draft' }, [], true)).toBe(true);
    expect(isCommandVisible(command, { Status: 'Draft' }, [], false)).toBe(false);
    expect(isCommandVisible(command, { Status: 'Submitted' }, [5], true)).toBe(false);
    expect(isCommandVisible({ id: 'cmd:2', title: 'y', actions: [] }, {}, [], false)).toBe(true);
    expect(collectCommandGroupIds({ schemaVersion: 1, listId: LIST_A, commands: [command, command] })).toEqual([5]);
  });

  it('newCommandId: egyedi azonosító', () => {
    expect(newCommandId([])).toBe('cmd:1');
    expect(newCommandId([{ id: 'cmd:2', title: '', actions: [] }])).toBe('cmd:3');
  });
});
