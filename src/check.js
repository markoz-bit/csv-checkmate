export function parseCsv(input, delimiter = ',') {
  if (delimiter.length !== 1 || /[\r\n"]/.test(delimiter)) throw new Error('Delimiter must be one character other than a quote or newline.');
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', state = 'start', pending = false;
  const cell = () => { row.push(field); field = ''; state = 'start'; };
  const record = () => { cell(); rows.push(row); row = []; pending = false; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    pending = true;
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else state = 'closed';
      } else field += ch;
    } else if (ch === delimiter) cell();
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record();
    } else if (state === 'closed') throw new Error('Unexpected character after closing quote.');
    else if (ch === '"') {
      if (state !== 'start') throw new Error('Unexpected quote in unquoted field.');
      state = 'quoted';
    } else { field += ch; state = 'plain'; }
  }
  if (state === 'quoted') throw new Error('Unclosed quoted field.');
  if (pending) record();
  return rows;
}

export function validateSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || !schema.columns || typeof schema.columns !== 'object' || Array.isArray(schema.columns)) throw new Error('Schema must contain a columns object.');
  for (const [name, rule] of Object.entries(schema.columns)) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error(`Invalid rule for ${name}.`);
    for (const key of Object.keys(rule)) if (!['required', 'unique', 'type', 'min', 'max', 'enum'].includes(key)) throw new Error(`Unknown rule ${key} for ${name}.`);
    for (const key of ['required', 'unique']) if (key in rule && typeof rule[key] !== 'boolean') throw new Error(`${key} must be boolean.`);
    if ('type' in rule && !['string', 'number', 'integer', 'date'].includes(rule.type)) throw new Error(`Unknown type for ${name}.`);
    for (const key of ['min', 'max']) if (key in rule && (!Number.isFinite(rule[key]) || !['number', 'integer'].includes(rule.type))) throw new Error(`${key} requires a numeric type and finite bound.`);
    if (rule.min > rule.max) throw new Error(`min exceeds max for ${name}.`);
    if ('enum' in rule && (!Array.isArray(rule.enum) || !rule.enum.every(v => typeof v === 'string'))) throw new Error('enum must be an array of strings.');
  }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function checkCsv(input, schema = { columns: {} }, delimiter = ',') {
  validateSchema(schema);
  const rows = parseCsv(input, delimiter);
  const issues = [];
  const add = (record, column, code, message) => issues.push({ record, column, code, message });
  if (!rows.length) {
    add(1, null, 'empty_file', 'File has no header.');
    return { ok: false, rows: 0, columns: [], issues };
  }
  const headers = rows[0];
  const seenHeaders = new Set();
  for (const header of headers) {
    if (!header.trim()) add(1, header, 'empty_header', 'Header must not be blank.');
    if (seenHeaders.has(header)) add(1, header, 'duplicate_header', 'Header appears more than once.');
    seenHeaders.add(header);
  }
  for (const name of Object.keys(schema.columns)) if (!headers.includes(name)) add(1, name, 'missing_column', 'Schema column is missing.');
  const seenValues = new Map();
  const seenRows = new Map();
  rows.slice(1).forEach((row, index) => {
    const record = index + 2;
    if (row.length !== headers.length) {
      add(record, null, 'column_count', `Expected ${headers.length} fields; found ${row.length}.`);
      return;
    }
    const signature = JSON.stringify(row);
    if (seenRows.has(signature)) add(record, null, 'duplicate_row', `Duplicates record ${seenRows.get(signature)}.`);
    else seenRows.set(signature, record);
    headers.forEach((name, col) => {
      const rule = Object.hasOwn(schema.columns, name) ? schema.columns[name] : {};
      const value = row[col].trim();
      if (!value) {
        if (rule.required) add(record, name, 'required', 'Value is required.');
        return;
      }
      if (rule.unique) {
        if (!seenValues.has(name)) seenValues.set(name, new Map());
        const values = seenValues.get(name);
        if (values.has(value)) add(record, name, 'unique', `Value repeats record ${values.get(value)}.`);
        else values.set(value, record);
      }
      if (['number', 'integer'].includes(rule.type)) {
        const number = Number(value);
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(number) || (rule.type === 'integer' && !Number.isSafeInteger(number))) add(record, name, 'type', `Expected ${rule.type}.`);
        else {
          if (rule.min !== undefined && number < rule.min) add(record, name, 'min', `Value is below ${rule.min}.`);
          if (rule.max !== undefined && number > rule.max) add(record, name, 'max', `Value exceeds ${rule.max}.`);
        }
      }
      if (rule.type === 'date' && !validDate(value)) add(record, name, 'type', 'Expected a real date in YYYY-MM-DD format.');
      if (rule.enum && !rule.enum.includes(value)) add(record, name, 'enum', 'Value is outside the allowed list.');
    });
  });
  return { ok: issues.length === 0, rows: rows.length - 1, columns: headers, issues };
}
