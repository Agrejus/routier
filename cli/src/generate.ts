import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FunctionRecorder } from "@routier/core";
import type { GenerateOptions } from "./args";
import { OUTPUT_FILE, renderOutput } from "./render";

export type ModuleLoader = (file: string) => Promise<void>;

export type GenerateResult =
    | { readonly ok: true; readonly schemas: readonly string[]; readonly file: string }
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

const loadFile = async (file: string, load: ModuleLoader): Promise<string[]> => {
    try {
        await load(file);

        return [];
    } catch (error) {
        return [`${file}: could not load the file: ${messageOf(error instanceof Error ? error : String(error))}`];
    }
};

const recordFiles = async (files: readonly string[], load: ModuleLoader, recorder: FunctionRecorder): Promise<string[]> => {
    const problems: string[] = [];

    Reflect.set(globalThis, RECORDER_GLOBAL, recorder);

    try {
        for (const file of files) {
            problems.push(...await loadFile(file, load));
        }
    } finally {
        Reflect.deleteProperty(globalThis, RECORDER_GLOBAL);
    }

    return problems;
};

export const generate = async (options: GenerateOptions, cwd: string, load: ModuleLoader): Promise<GenerateResult> => {
    const out = resolve(cwd, options.out);
    const output = join(out, OUTPUT_FILE);
    const files = await findFiles(options.patterns, cwd, output);
    const recorder: FunctionRecorder = { functions: new Map(), collections: new Set() };
    const problems = await recordFiles(files, load, recorder);

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

    return { ok: true, schemas: [...recorder.collections].sort(), file: output };
};
