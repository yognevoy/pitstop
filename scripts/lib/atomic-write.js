import { renameSync, writeFileSync } from 'node:fs';

export function writeAtomic(path, content) {
  const tmpPath = `${path}.tmp`;

  writeFileSync(tmpPath, content);
  renameSync(tmpPath, path);
}
