import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from './schema.js';

export const DEFAULT_CONFIG = {
  fallback_since: '4 weeks ago',
  report_top_k: 5,
  levels: {
    quick: { max_files: 15 },
    full: { max_files: 40 },
    deep: { max_files: 80 },
  },
};

/**
 * Loads `.pitstop/config.json` if present, validates it against schema, and
 * merges it over DEFAULT_CONFIG. Missing fields keep their default.
 */
export function loadConfig(dir, schema) {
  const configPath = join(dir, '.pitstop/config.json');

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const userConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  const errors = validate(schema, userConfig);

  if (errors.length > 0) {
    throw new Error(`Invalid .pitstop/config.json:\n${errors.join('\n')}`);
  }

  return mergeConfig(userConfig);
}

function mergeConfig(userConfig) {
  return {
    fallback_since: userConfig.fallback_since ?? DEFAULT_CONFIG.fallback_since,
    report_top_k: userConfig.report_top_k ?? DEFAULT_CONFIG.report_top_k,
    levels: mergeLevels(userConfig.levels ?? {}),
  };
}

function mergeLevels(userLevels) {
  const merged = {};

  for (const [level, defaultLevel] of Object.entries(DEFAULT_CONFIG.levels)) {
    merged[level] = { max_files: userLevels[level]?.max_files ?? defaultLevel.max_files };
  }

  return merged;
}
