import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const srcDir = path.join(repoRoot, 'examples');
const destDir = path.join(repoRoot, 'docs', '_includes', 'code');

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function copyTree(src, dest) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    await ensureDir(dest);
    for (const entry of entries) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyTree(s, d);
        } else if (
            entry.isFile() &&
            (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))
        ) {
            await fs.copyFile(s, d);
        }
    }
}

await ensureDir(destDir);
try {
    await copyTree(srcDir, destDir);
    console.log('Synced examples to docs/_includes/code');
} catch (err) {
    if (err.code === 'ENOENT') {
        console.error('Examples source folder not found:', srcDir);
        process.exit(1);
    }
    throw err;
}

