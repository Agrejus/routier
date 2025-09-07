import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const docsDir = path.join(repoRoot, 'docs');
const examplesRoot = path.join(repoRoot, 'examples', 'from-docs');

const SUPPORTED = new Set(['ts', 'tsx', 'js', 'javascript', 'typescript']);
const EXT_MAP = { ts: 'ts', tsx: 'tsx', js: 'js', javascript: 'js', typescript: 'ts' };

async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '_includes' || entry.name === 'node_modules') continue;
            yield* walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            yield full;
        }
    }
}

function* extractBlocks(markdown) {
    // Matches ```lang\n...\n```
    const fence = /```(\w+)\n([\s\S]*?)\n```/g;
    let match;
    while ((match = fence.exec(markdown)) !== null) {
        const [full, langRaw, code] = match;
        const lang = (langRaw || '').toLowerCase();
        yield { full, lang, code, index: match.index };
    }
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function processFile(absPath) {
    const relFromDocs = path.relative(docsDir, absPath);
    const content = await fs.readFile(absPath, 'utf8');
    let changed = false;
    let updated = content;

    // We will build replacements sequentially to avoid overlapping indices
    const blocks = Array.from(extractBlocks(content));
    let offset = 0;

    for (let i = 0; i < blocks.length; i++) {
        const { full, lang, code } = blocks[i];
        if (!SUPPORTED.has(lang)) continue;

        const ext = EXT_MAP[lang];
        const targetDir = path.join(
            examplesRoot,
            path.dirname(relFromDocs.replace(/\.md$/i, '')),
            path.basename(relFromDocs, '.md')
        );
        const targetName = `block-${i + 1}.${ext}`;
        const targetPath = path.join(targetDir, targetName);
        await ensureDir(targetDir);
        await fs.writeFile(targetPath, code, 'utf8');

        const includePath = path.posix.join(
            'from-docs',
            path.dirname(relFromDocs.replace(/\\/g, '/').replace(/\.md$/i, '')),
            path.basename(relFromDocs, '.md'),
            targetName
        );

        const replacement = `\n{% highlight ${ext} linenos %}{% include code/${includePath} %}{% endhighlight %}\n`;

        const start = updated.indexOf(full, offset);
        if (start !== -1) {
            updated = updated.slice(0, start) + replacement + updated.slice(start + full.length);
            offset = start + replacement.length;
            changed = true;
        }
    }

    if (changed) {
        await fs.writeFile(absPath, updated, 'utf8');
    }
}

async function run() {
    await ensureDir(examplesRoot);
    for await (const file of walk(docsDir)) {
        // Skip files under docs/_includes
        if (file.includes(`${path.sep}_includes${path.sep}`)) continue;
        await processFile(file);
    }
    console.log('Extracted code blocks to examples/from-docs and updated docs to include them.');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});


