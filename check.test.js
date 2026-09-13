import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCsv, checkCsv, validateSchema } from '../src/check.js';

test('quoted delimiters, escaped quotes, CRLF, BOM and multiline cells', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"one,two","say ""hi""\nagain"\r\n'), [['a','b'],['one,two','say "hi"\nagain']]);
});
test('trailing empty field and absent final newline', () => {
  assert.deepEqual(parseCsv('a;b\n1;', ';'), [['a','b'],['1','']]);
});
test('malformed quoting and invalid delimiters fail', () => {
  for (const input of ['a\n"unfinished', 'a\nx"y', 'a\n"x"y']) assert.throws(() => parseCsv(input));
  for (const delimiter of ['', ';;', '"', '\n']) assert.throws(() => parseCsv('a', delimiter));
});
test('empty file, empty/duplicate headers and ragged rows', () => {
  assert.equal(checkCsv('').issues[0].code, 'empty_file');
  assert.deepEqual(checkCsv('a,a,\n1,2').issues.map(x => x.code), ['duplicate_header','empty_header','column_count']);
});
test('required, uniqueness, bounds, enums and calendar dates', () => {
  const schema = {columns: {id: {required:true, unique:true, type:'integer'}, qty: {type:'number', min:0, max:10}, date:{type:'date'}, state:{enum:['ok']}}};
  const report = checkCsv('id,qty,date,state\n1,-1,2025-02-29,no\n1,11,2024-02-29,ok\n,abc,no,ok', schema);
  assert.deepEqual(report.issues.map(x => x.code), ['min','type','enum','unique','max','required','type','type']);
  assert.equal(report.rows, 3);
});
test('numeric syntax rejects hex, Infinity and unsafe integers', () => {
  for (const value of ['0x10', 'Infinity', '9007199254740992', '1.5']) assert.equal(checkCsv(`id\n${value}`, {columns:{id:{type:'integer'}}}).ok, false);
  assert.equal(checkCsv('id\n1e2', {columns:{id:{type:'integer'}}}).ok, true);
});
test('duplicate rows and missing schema columns', () => {
  assert.deepEqual(checkCsv('a\nx\nx', {columns:{b:{}}}).issues.map(x => x.code), ['missing_column','duplicate_row']);
});
test('unknown rules and invalid schemas fail instead of silently passing', () => {
  for (const schema of [null, {}, {columns:[]}, {columns:{a:{typo:true}}}, {columns:{a:{type:'email'}}}, {columns:{a:{min:1}}}, {columns:{a:{enum:[1]}}}, {columns:{a:{type:'number',min:2,max:1}}}]) assert.throws(() => validateSchema(schema));
});
test('optional blank values are allowed; prototype-like headers work', () => {
  assert.equal(checkCsv('a,b\n,ok', {columns:{a:{type:'number'}}}).ok, true);
  assert.equal(checkCsv('__proto__,constructor\nx,y').ok, true);
});
const cwd = fileURLToPath(new URL('../', import.meta.url));
const run = (...args) => spawnSync(process.execPath, ['src/cli.js', ...args], {cwd, encoding:'utf8'});
test('CLI valid demo and structured report', () => {
  const result = run('examples/valid.csv','--schema','examples/rules.json','--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});
test('CLI validation issues return code 1', () => {
  const result = run('examples/invalid.csv','--schema','examples/rules.json','--json');
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).issues.length, 6);
});
test('CLI usage and file failures return code 2', () => {
  for (const args of [['missing.csv'], ['--schema'], ['examples/valid.csv','--oops'], ['examples/valid.csv','--delimiter',';;']]) assert.equal(run(...args).status, 2);
  assert.equal(run('--help').status, 0);
});
