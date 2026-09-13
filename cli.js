#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { checkCsv } from './check.js';

const help = `CSV Checkmate — local CSV validation
Usage: node src/cli.js FILE [--schema RULES.json] [--delimiter ";"] [--json]
Exit codes: 0 valid, 1 validation issues, 2 input/configuration error.
Without a schema: checks headers, field counts and duplicate records.
UTF-8 input only. Records, not physical lines, are numbered in reports.`;

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) { console.log(help); process.exit(0); }
  let file, schemaPath, delimiter = ',', json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') json = true;
    else if (arg === '--schema' || arg === '--delimiter') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
      if (arg === '--schema') schemaPath = value;
      else delimiter = value === '\\t' ? '\t' : value;
    } else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else if (file) throw new Error('Specify exactly one CSV file.');
    else file = arg;
  }
  if (!file) throw new Error('CSV file is required.');
  const decode = path => new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
  const schema = schemaPath ? JSON.parse(decode(schemaPath)) : { columns: {} };
  const report = checkCsv(decode(file), schema, delimiter);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.ok ? 'PASS' : 'FAIL'}: ${report.rows} data records, ${report.issues.length} issues`);
    for (const issue of report.issues) console.log(`Record ${issue.record}${issue.column === null ? '' : ` / ${JSON.stringify(issue.column)}`}: [${issue.code}] ${issue.message}`);
  }
  process.exitCode = report.ok ? 0 : 1;
} catch (error) { console.error(`Error: ${error.message}`); process.exitCode = 2; }
