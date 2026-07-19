/**
 * sqlite3@6 ships prebuilds linked against GLIBC_2.38+.
 * Railway Nixpacks (and some Debian hosts) have older glibc, so dlopen fails at runtime.
 * If the prebuilt binding cannot load, rebuild from source against the host toolchain.
 */
import { createRequire } from 'module';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);

function canLoad() {
  try {
    require('sqlite3');
    return true;
  } catch {
    return false;
  }
}

if (canLoad()) {
  console.log('[ensure-sqlite3] native binding ok');
  process.exit(0);
}

console.warn('[ensure-sqlite3] prebuilt failed to load; rebuilding from source...');
try {
  execSync('npm rebuild sqlite3 --build-from-source', { stdio: 'inherit' });
} catch (err) {
  console.error('[ensure-sqlite3] rebuild failed', err?.message || err);
  process.exit(1);
}

if (!canLoad()) {
  console.error('[ensure-sqlite3] rebuilt binding still fails to load');
  process.exit(1);
}

console.log('[ensure-sqlite3] rebuilt from source and loads ok');
