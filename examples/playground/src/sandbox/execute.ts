export type ModuleValue = object | string | number | boolean | bigint | symbol | null | undefined;

export type ModuleExports = Record<string, ModuleValue>;

export type ModuleLoader = () => Promise<ModuleExports>;

type CommonJsModule = { exports: ModuleExports };

const REQUIRE = /\brequire\("([^"]+)"\)/g;

export const requiredModules = (js: string): string[] =>
    [...new Set(Array.from(js.matchAll(REQUIRE)).flatMap(match => match.slice(1)))];

export const loadModules = async (names: readonly string[], loaders: Readonly<Record<string, ModuleLoader>>): Promise<Map<string, ModuleExports>> => {
    const loaded = await Promise.all(names.map(async name => {
        const load = loaders[name];

        if (load === undefined) {
            throw new Error(`"${name}" is not available in the playground. You can import: ${Object.keys(loaders).sort().join(', ')}`);
        }

        return [name, await load()] as const;
    }));

    return new Map(loaded);
};

export const evaluate = (js: string, modules: ReadonlyMap<string, ModuleExports>): ModuleExports => {
    const module: CommonJsModule = { exports: {} };
    const require = (name: string): ModuleExports => {
        const exports = modules.get(name);

        if (exports === undefined) {
            throw new Error(`"${name}" was not loaded`);
        }

        return exports;
    };

    new Function('require', 'exports', 'module', js)(require, module.exports, module);

    return module.exports;
};
