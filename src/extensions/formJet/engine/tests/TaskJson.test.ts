import {
  buildTaskJsonResponse,
  ITaskJsonForm,
  parseTaskJson,
  pickTaskJsonForm,
  taskJsonValues,
  validateTaskJson
} from '../TaskJson';

const REQUEST: string = JSON.stringify({
  taskType: '14_CS_CreatingSalesInvoice',
  fields: [
    { name: 'ArePricesChecked', label: 'Prices are checked on items?', type: 'yes/no', required: true, value: '' },
    { name: 'SalesInvoiceReference', label: 'Sales invoice reference', type: 'text', required: true, value: '' },
    { name: 'Comment', label: 'Comment', type: 'multiline', required: false, value: '' },
    { name: 'Amount', label: 'Amount', type: 'number', value: '' },
    { name: 'DueDate', label: 'Due date', type: 'date', value: '2026-11-05T00:00:00Z' },
    { name: 'Kind', type: 'choice', options: ['A', { value: 'b', label: 'B' }, { key: 'c' }], value: 'b', extra: 1 },
    { label: 'névtelen' }
  ]
});

describe('TaskJson – JSON alapú feladat', () => {
  it('parseTaskJson: a mezők típusa, kezdőértéke és választható értékei; a névtelen mező kimarad', () => {
    const form = parseTaskJson(REQUEST) as ITaskJsonForm;
    expect(form.fields.map((field) => [field.name, field.type, field.required])).toEqual([
      ['ArePricesChecked', 'yesno', true],
      ['SalesInvoiceReference', 'text', true],
      ['Comment', 'multiline', false],
      ['Amount', 'number', false],
      ['DueDate', 'date', false],
      ['Kind', 'choice', false]
    ]);
    expect(form.fields[5].label).toBe('Kind');
    expect(form.fields[5].options).toEqual([
      { value: 'A', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'c' }
    ]);
    expect(taskJsonValues(form)).toEqual({
      ArePricesChecked: '',
      SalesInvoiceReference: '',
      Comment: '',
      Amount: '',
      DueDate: '2026-11-05',
      Kind: 'b'
    });
    expect(parseTaskJson(JSON.stringify({ fields: [{ name: 'x', type: 'yes/no', value: true }, { name: 'y', type: 'ismeretlen' }] }))?.fields).toMatchObject([
      { name: 'x', type: 'yesno', value: 'yes' },
      { name: 'y', type: 'text' }
    ]);
  });

  it('parseTaskJson: üres, hibás vagy fields nélküli JSON → undefined; a válasz elsőbbséget kap', () => {
    expect(parseTaskJson('')).toBeUndefined();
    expect(parseTaskJson('{nope')).toBeUndefined();
    expect(parseTaskJson('{"fields":{}}')).toBeUndefined();
    const response: string = JSON.stringify({ fields: [{ name: 'SalesInvoiceReference', value: 'INV-1' }] });
    expect(pickTaskJsonForm(REQUEST, response)?.fields[0].value).toBe('INV-1');
    expect(pickTaskJsonForm(REQUEST, '')?.fields).toHaveLength(6);
    expect(pickTaskJsonForm(REQUEST, 'hibás')?.fields).toHaveLength(6);
  });

  it('validateTaskJson: kötelező mező és szám ellenőrzése', () => {
    const form = parseTaskJson(REQUEST) as ITaskJsonForm;
    expect(validateTaskJson(form, { ...taskJsonValues(form), SalesInvoiceReference: '  ', Amount: '12a' })).toEqual({
      ArePricesChecked: 'required',
      SalesInvoiceReference: 'required',
      Amount: 'number'
    });
    expect(validateTaskJson(form, { ...taskJsonValues(form), ArePricesChecked: 'no', SalesInvoiceReference: 'X', Amount: '1,5' })).toEqual({});
  });

  it('buildTaskJsonResponse: a kitöltött értékek; a JSON többi része változatlan', () => {
    const form = parseTaskJson(REQUEST) as ITaskJsonForm;
    const response = JSON.parse(
      buildTaskJsonResponse(form, { ...taskJsonValues(form), ArePricesChecked: 'yes', SalesInvoiceReference: ' INV-9 ', Comment: 'a\nb ', Amount: '1,5' })
    );
    expect(response.taskType).toBe('14_CS_CreatingSalesInvoice');
    expect(response.fields.map((field: { value?: unknown }) => field.value)).toEqual(['yes', 'INV-9', 'a\nb ', '1.5', '2026-11-05', 'b', undefined]);
    expect(response.fields[0]).toEqual({ name: 'ArePricesChecked', label: 'Prices are checked on items?', type: 'yes/no', required: true, value: 'yes' });
    expect(response.fields[5].extra).toBe(1);
    expect(response.fields[6]).toEqual({ label: 'névtelen' });
  });
});
