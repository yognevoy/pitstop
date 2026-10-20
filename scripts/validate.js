import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { git } from './lib/git.js';
import { validate as validateSchema } from './lib/schema.js';

/**
 * Reads every agent's raw findings from `<dir>/.pitstop/run/raw/*.json`,
 * checks each finding against the schema, then against its anchors.
 */
export function validate(dir, schema) {
  const rawDir = join(dir, '.pitstop/run/raw');

  if (!existsSync(rawDir)) {
    return { valid: [], rejected: [] };
  }

  const valid = [];
  const rejected = [];

  for (const file of readdirSync(rawDir)) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const agent = basename(file, '.json');
    const result = validateFile(dir, schema, agent, join(rawDir, file));

    valid.push(...result.valid);
    rejected.push(...result.rejected);
  }

  return { valid, rejected };
}

function validateFile(dir, schema, agent, path) {
  let findings;

  try {
    findings = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return { valid: [], rejected: [{ agent, reasons: [`invalid JSON: ${err.message}`] }] };
  }

  if (!Array.isArray(findings)) {
    return { valid: [], rejected: [{ agent, reasons: ['expected a JSON array of findings'] }] };
  }

  const valid = [];
  const rejected = [];

  for (const finding of findings) {
    const errors = checkFinding(dir, schema, finding);

    if (errors.length === 0) {
      valid.push(finding);
    } else {
      rejected.push({ agent, finding, reasons: errors });
    }
  }

  return { valid, rejected };
}

function checkFinding(dir, schema, finding) {
  const errors = validateSchema(schema, finding);

  if (errors.length > 0) {
    return errors;
  }

  for (const anchor of finding.anchors) {
    const error = checkAnchor(dir, anchor);

    if (error) {
      errors.push(error);
    }
  }

  return errors;
}

function checkAnchor(dir, anchor) {
  const path = join(dir, anchor.file);

  if (!existsSync(path)) {
    return `anchor file "${anchor.file}" does not exist`;
  }

  const content = readFileSync(path, 'utf8');
  const found = anchor.symbols.some((symbol) => content.includes(symbol));

  if (!found) {
    return `no symbol in ${JSON.stringify(anchor.symbols)} found in "${anchor.file}"`;
  }

  return null;
}

function main() {
  const dir = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const schema = JSON.parse(readFileSync(new URL('../schemas/finding.schema.json', import.meta.url)));

  const { valid, rejected } = validate(dir, schema);

  const validPath = join(dir, '.pitstop/run/validated.json');
  const rejectedPath = join(dir, '.pitstop/run/rejected.json');

  mkdirSync(dirname(validPath), { recursive: true });
  writeFileSync(validPath, JSON.stringify(valid, null, 2));
  writeFileSync(rejectedPath, JSON.stringify(rejected, null, 2));

  console.log(`Validated ${valid.length} finding(s), rejected ${rejected.length}.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
