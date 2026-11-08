import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FunctionRecorder } from "@routier/core";
import type { GenerateOptions } from "./args";
import { findRoutierPackages, resolvePackage } from "./packages";
import { OUTPUT_FILE, renderOutput } from "./render";

export type ModuleLoader = (file: string) => Promise<void>;

export type GenerateResult =
    | { readonly ok: true; readonly schemas: readonly string[]; readonly file: string; readonly skipped: readonly string[] }
    | { readonly ok: false; readonly problems: readonly string[] };

const RECORDER_GLOBAL = "__routierFunctionRecorder";
const SCAN_PATTERN = "src/**/*";

const messageOf = (error: Error | string): string =>
    typeof error === "string" ? error : error.message;

const isScript = (file: string): boolean =>
    /\.[cm]?[jt]sx?$/.test(file) && !/\.d\.[cm]?ts$/.test(file);

const isTest = (file: string): boolean => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);

const compilesSchema = (source: string): boolean =>
    source.includes("@routier/core") && /\.compile\s*\(/.test(source);

const isScanTarget = async (file: string): Promise<boolean> =>
    !isTest(file) && compilesSchema((await readFile(file)).toString());

const findScripts = async (patterns: readonly string[], cwd: string, output: string): Promise<string[]> => {
    const files = new Set<string>();
    const entries = glob([...patterns], { cwd, withFileTypes: true, exclude: entry => entry.name === "node_modules" });

    for await (const entry of entries) {
        const file = join(entry.parentPath, entry.name);

        if (entry.isFile() && isScript(file) && file !== output) {
            files.add(file);
        }
    }

    return [...files];
};

const findFiles = async (patterns: readonly string[], cwd: string, output: string): Promise<string[]> => {
    if (patterns.length > 0) {
        return findScripts(patterns, cwd, output);
    }

    const scripts = await findScripts([SCAN_PATTERN], cwd, output);
    const targets = await Promise.all(scripts.map(isScanTarget));

    return scripts.filter((_, index) => targets[index]);
};

const failureOf = async (run: () => Promise<void>): Promise<string | null> => {
    try {
        await run();

        return null;
    } catch (error) {
        return messageOf(error instanceof Error ? error : String(error));
    }
};

const loadPackages = async (cwd: string, load: ModuleLoader): Promise<string[]> => {
    const skipped: string[] = [];

    for (const name of await findRoutierPackages(cwd)) {
        const failure = await failureOf(() => load(resolvePackage(name, cwd)));

        if (failure != null) {
            skipped.push(`${name}: could not load it in Node: ${failure}`);
        }
    }

    return skipped;
};

const loadFiles = async (files: readonly string[], load: ModuleLoader): Promise<string[]> => {
    const problems: string[] = [];

    for (const file of files) {
        const failure = await failureOf(() => load(file));

        if (failure != null) {
            problems.push(`${file}: could not load the file: ${failure}`);
        }
    }

    return problems;
};

const record = async <T>(recorder: FunctionRecorder, run: () => Promise<T>): Promise<T> => {
    Reflect.set(globalThis, RECORDER_GLOBAL, recorder);

    try {
        return await run();
    } finally {
        Reflect.deleteProperty(globalThis, RECORDER_GLOBAL);
    }
};

export const generate = async (options: GenerateOptions, cwd: string, load: ModuleLoader): Promise<GenerateResult> => {
    const out = resolve(cwd, options.out);
    const output = join(out, OUTPUT_FILE);
    const files = await findFiles(options.patterns, cwd, output);
    const recorder: FunctionRecorder = { functions: new Map(), collections: new Set() };
    const { skipped, problems } = await record(recorder, async () => ({
        skipped: await loadPackages(cwd, load),
        problems: await loadFiles(files, load),
    }));

    if (problems.length > 0) {
        return { ok: false, problems };
    }

    if (recorder.functions.size === 0) {
        return { ok: false, problems: [`Found no compiled schemas in ${files.length} files.`] };
    }

    await mkdir(out, { recursive: true });

    for (const { name, content } of renderOutput([...recorder.functions.values()])) {
        await writeFile(join(out, name), content);
    }

    return { ok: true, schemas: [...recorder.collections].sort(), file: output, skipped };
};
