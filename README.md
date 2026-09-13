# CSV Checkmate

A small, dependency-free command-line tool for checking CSV exports before importing them into another system. It reads files locally and prints a text or JSON report. No account, API key, or network connection is needed at runtime.

**Status:** initial release, with automated tests. No established adoption or production track record is claimed.

## Quick start / Szybki start

Install Node.js 22 or newer. Open a terminal in this project folder:

```sh
node src/cli.js examples/valid.csv --schema examples/rules.json
node --test
```

Expected demo result: `PASS: 2 data records, 0 issues`.

Po polsku: wskaż własny plik CSV zamiast `examples/valid.csv`. Reguły kolumn dopasuj w pliku JSON na podstawie `examples/rules.json`. Program nie zmienia pliku źródłowego i nie wysyła jego zawartości do internetu.

```sh
node src/cli.js your-file.csv --schema examples/rules.json --json
node src/cli.js your-file.csv --delimiter ";"
node src/cli.js your-file.tsv --delimiter "\t"
```

## Checks

- Empty or repeated headers, inconsistent field counts and duplicate complete records.
- Required values and unique column values.
- Decimal numbers, safe integers, numeric lower/upper bounds.
- Real calendar dates in `YYYY-MM-DD` format.
- Allowed text values using `enum`.
- Missing columns referenced by a schema.

Without a schema, only structural and duplicate-record checks run. Missing cell values require an explicit `required` rule. Blank data records are not silently discarded.

## Schema

```json
{
  "columns": {
    "id": { "type": "integer", "required": true, "unique": true },
    "price": { "type": "number", "min": 0, "max": 10000 },
    "created": { "type": "date" },
    "status": { "enum": ["active", "archived"] }
  }
}
```

Column names match exactly, including case and whitespace. Cell values are trimmed for rule checks and uniqueness; duplicate complete records use original parsed values. All columns listed in a schema must exist; `required` controls whether their cells may be blank. Extra CSV columns are accepted. Unknown column rules cause an error. Optional empty values skip type, enum and uniqueness checks.

Quoted delimiters, doubled quotes, multiline quoted values, UTF-8 BOM, LF and CRLF are supported. Reports count logical records, with the header as record 1, rather than physical lines. Numeric parsing uses a dot decimal separator and accepts exponent notation. Integers must fit JavaScript's safe integer range.

## Automation

Exit codes: **0** = passed; **1** = validation issues; **2** = unreadable file, malformed CSV, invalid UTF-8, or invalid configuration. `--json` outputs a structured validation report to standard output. Input/configuration errors are text on standard error, including when `--json` is selected.

## Limits

The complete file and report are held in memory: use small to medium exports, not multi-gigabyte data. Numeric checks use floating-point arithmetic and are not an exact-decimal accounting engine. Encoding must be UTF-8. The delimiter must be provided for non-comma files. No automatic repairs are performed. Reports include column names but omit cell values; column names can themselves contain sensitive information.

## Development

```sh
node --test
```

No dependency installation is needed. CI runs the tests on Linux and Windows. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance and [ROADMAP.md](ROADMAP.md) for proposed future work.

## License

MIT — see [LICENSE](LICENSE).
