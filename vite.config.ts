import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Writes dist/sw.js with the exact list of built files to precache (so the whole app works
 * offline after the first visit) and dist/version.json for checking deployments.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'bead-studio-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const skip = new Set(['sw.js', 'version.json', '_headers', 'index.html']);
      const files = listFiles(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter((f) => !skip.has(f) && !f.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const f of [...files, 'index.html']) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const precache = ['/', ...files.map((f) => `/${f}`)];
      const tpl = readFileSync('sw/sw-template.js', 'utf8');
      writeFileSync(join(outDir, 'sw.js'), tpl.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache, null, 1)));
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ version, commit: commitSha(), builtAt: new Date().toISOString() }) + '\n');
    },
  };
}

export default defineConfig({
  plugins: [preact(), serviceWorker()],
  build: {
    target: ['es2020', 'safari14'],
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
  server: { host: true },
  preview: { host: true },
});
