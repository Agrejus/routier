import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const docsDir = path.join(repoRoot, 'docs');

async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === '_includes' || e.name === 'node_modules') continue;
            yield* walk(full);
        } else if (e.isFile() && e.name.endsWith('.md')) {
            yield full;
        }
    }
}

function transform(content) {
    // Match blocks of the form:
    // {% highlight ts linenos %}{% include code/... %}{% endhighlight %}
    // and replace with capture + highlight
    const re = /\{\%\s*highlight\s+([^%]+?)\s*\%\}\s*\{\%\s*include\s+([^%]+?)\s*\%\}\s*\{\%\s*endhighlight\s*\%\}/g;
    let out = content.replace(re, (_m, lang, inc) => {
        const captureVar = 'snippet_' + Math.random().toString(36).slice(2, 8);
        return `\n{% capture ${captureVar} %}{% include ${inc.trim()} %}{% endcapture %}\n{% highlight ${lang.trim()} %}{{ ${captureVar} | strip }}{% endhighlight %}\n`;
    });
    // Transform capture+highlight to fenced code blocks to avoid theme parsing quirks
    // Fix any accidental placeholders like {% include code/%} created by earlier passes
    out = out.replace(/\{\%\s*include\s+code\/\%\s*\}/g, '{% include code/from-docs/index/block-1.ts %}');
    // Keep capture+highlight; do not convert to fenced blocks to avoid breaking includes
    return out;
}

async function run() {
    let changedFiles = 0;
    for await (const file of walk(docsDir)) {
        const before = await fs.readFile(file, 'utf8');
        const after = transform(before);
        if (after !== before) {
            await fs.writeFile(file, after, 'utf8');
            changedFiles++;
        }
    }
    console.log(`Updated ${changedFiles} files with capture+highlight includes.`);
}

run().catch((err) => { console.error(err); process.exit(1); });
