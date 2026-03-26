import fs from 'fs';
import path from 'path';

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.data');

function resolveDataDir() {
  return process.env.POLKASEND_DATA_DIR || DEFAULT_DATA_DIR;
}

export function readCollection<T>(filename: string): T[] {
  const dataDir = resolveDataDir();
  const filePath = path.join(dataDir, filename);

  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return [];
  }

  return JSON.parse(raw) as T[];
}

export function writeCollection<T>(filename: string, rows: T[]): void {
  const dataDir = resolveDataDir();
  const filePath = path.join(dataDir, filename);
  const tempPath = `${filePath}.tmp`;

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}
