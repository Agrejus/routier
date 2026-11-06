import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const project = join(here, "project");
const out = join(here, "build");
const pages = join(project, "src/pages");

const APP_PAGES = ["memory", "dexie", "missing", "late", "probe"];
const POLICIES = {
    strict: "default-src 'self'; script-src 'self'",
    eval: "default-src 'self'; script-src 'self' 'unsafe-eval'",
};
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

const failures = [];
const check = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail == null ? "" : `  ${detail}`}`);
    if (!ok) failures.push(name);
};

const loadPlaywright = async () => {
    try {
        return await import("playwright-core");
    } catch {
        console.error("the CSP check needs playwright-core and a Chromium build:\n  npx playwright-core install chromium\nSkipping.");
        process.exit(2);
    }
};

const generate = () => {
    const result = spawnSync(
        join(repo, "node_modules/.bin/tsx"),
        [join(repo, "cli/src/index.ts"), "generate", "--out", "../build"],
        { cwd: project, encoding: "utf8" },
    );

    if (result.status !== 0) {
        throw new Error(`routier generate failed:\n${result.stdout}${result.stderr}`);
    }

    return result.stdout.split("\n")[0];
};

const bundle = async () => {
    const common = { bundle: true, minify: true, target: "es2022", logLevel: "error", outdir: out };

    await build({ ...common, entryPoints: [join(pages, "guard.ts")], format: "iife" });
    await build({ ...common, entryPoints: APP_PAGES.map(name => join(pages, `${name}.ts`)), format: "esm", conditions: ["browser"] });

    for (const name of APP_PAGES) {
        await writeFile(
            join(out, `${name}.html`),
            `<!doctype html><title>${name}</title><script src="./guard.js"></script><script type="module" src="./${name}.js"></script>`,
        );
    }
};

const serve = () => new Promise(ready => {
    const server = createServer(async (request, response) => {
        const [, policy, file] = request.url.split("?")[0].split("/");

        try {
            const body = await readFile(join(out, file));

            response.writeHead(200, {
                "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
                "Content-Security-Policy": POLICIES[policy],
                "Cache-Control": "no-store",
            });
            response.end(body);
        } catch {
            response.writeHead(404);
            response.end("not found");
        }
    });

    server.listen(0, "127.0.0.1", () => ready({ server, port: server.address().port }));
});

const openPage = async (context, port, policy, name) => {
    const page = await context.newPage();
    const pageErrors = [];
    const policyHeader = new Promise(found => {
        page.on("response", response => {
            if (response.url().endsWith(`${name}.html`)) found(response.headers()["content-security-policy"]);
        });
    });

    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/${policy}/${name}.html`);
    await page.waitForFunction(() => window.__result != null || window.__error != null, null, { timeout: 30_000 });
    await page.waitForTimeout(100);

    const state = await page.evaluate(() => ({
        result: window.__result ?? null,
        error: window.__error ?? null,
        violations: window.__violations,
    }));

    await page.close();

    return { ...state, pageErrors, header: await policyHeader };
};

const todo = (name, done, owner, tags) => ({
    name,
    done,
    label: "todo-label",
    upper: name.toUpperCase(),
    meta: { owner },
    tags,
});

const SHIP = todo("ship", false, "c", ["y", "z"]);
const WRITE = todo("write", false, "a", ["x"]);
const EXPECTED_STORE = {
    added: [SHIP, todo("test", false, "b", []), WRITE],
    edited: [SHIP, todo("test", true, "b", []), WRITE],
    remaining: [todo("test", true, "b", []), WRITE],
};
const EXPECTED_ENTITY = { id: "a", name: "x", done: false, meta: { owner: "o" }, tags: ["t"], label: "todo-label", upper: "X" };

const sameJson = (actual, expected) => isDeepStrictEqual(actual, expected);

const main = async () => {
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });

    console.log(`\n  ${generate()}`);
    await bundle();

    const { server, port } = await serve();
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

    try {
        const context = await browser.newContext();

        console.log("\nthe policy itself\n");

        const blocked = await openPage(context, port, "strict", "probe");
        const allowed = await openPage(context, port, "eval", "probe");

        check("the strict page is served with the header", blocked.header === POLICIES.strict, blocked.header);
        check("the strict policy blocks new Function", blocked.result?.newFunction === "EvalError", blocked.result?.newFunction);
        check("the strict policy blocks eval", blocked.result?.indirectEval === "EvalError", blocked.result?.indirectEval);
        check("the browser reports those blocks as violations", blocked.violations.length === 2, `${blocked.violations.length}`);
        check("the control policy allows new Function", allowed.result?.newFunction === "ran:1", allowed.result?.newFunction);

        console.log("\nno generated file, eval allowed: the behavior to match\n");

        const baseline = await openPage(context, port, "eval", "missing");

        check("the app runs", baseline.result?.ok === true, baseline.result?.error);
        check("the store returns the expected rows", sameJson(baseline.result?.store, EXPECTED_STORE), JSON.stringify(baseline.result?.store)?.slice(0, 300));
        check("the schema functions return the expected entity", sameJson(baseline.result?.schema?.entity, EXPECTED_ENTITY), JSON.stringify(baseline.result?.schema?.entity));

        console.log("\ngenerated file, eval blocked\n");

        for (const name of ["memory", "dexie"]) {
            const page = await openPage(context, port, "strict", name);

            check(`${name}: add, read, edit and remove work`, page.result?.ok === true, page.result?.error ?? page.error ?? page.pageErrors[0]);
            check(`${name}: no policy violations, so nothing tried eval`, page.violations.length === 0, page.violations.join(", "));

            check(`${name}: same results as with eval`, sameJson(page.result, baseline.result));
        }

        console.log("\neval blocked, generated file not usable\n");

        for (const [name, label] of [["missing", "not imported"], ["late", "imported too late"]]) {
            const page = await openPage(context, port, "strict", name);
            const message = page.pageErrors[0] ?? page.error ?? "";

            check(`${label}: the app stops`, page.result == null, JSON.stringify(page.result)?.slice(0, 100));
            check(`${label}: the error names the schema`, message.includes("The schema 'todos' has no generated function."), message.slice(0, 160));
            check(`${label}: the error names the fix`, message.includes('Run "npx @routier/cli generate", and import the generated file before your schemas.'));
        }
    } finally {
        await browser.close();
        server.close();
    }

    console.log("");

    if (failures.length > 0) {
        console.error(`${failures.length} failed: ${failures.join(", ")}`);
        process.exit(1);
    }

    console.log("all checks passed");
};

await main();
