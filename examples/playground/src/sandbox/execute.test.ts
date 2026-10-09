import { describe, expect, it } from '@jest/globals';
import { evaluate, loadModules, requiredModules, type ModuleExports, type ModuleLoader } from './execute';

const loaders = (modules: Record<string, ModuleExports>): Record<string, ModuleLoader> =>
    Object.fromEntries(Object.entries(modules).map(([name, exports]) => [name, async () => exports]));

describe('requiredModules', () => {
    it('lists each module the compiled code requires, once, in order', () => {
        const js = 'const a = require("@routier/core");\nconst b = require("react");\nconst c = require("@routier/core");';

        expect(requiredModules(js)).toEqual(['@routier/core', 'react']);
    });

    it('finds nothing in code that requires nothing', () => {
        expect(requiredModules('exports.run = () => 1;')).toEqual([]);
    });
});

describe('loadModules', () => {
    it('loads only the modules asked for', async () => {
        let loaded = 0;
        const available: Record<string, ModuleLoader> = {
            used: async () => { loaded++; return { value: 1 }; },
            unused: async () => { loaded++; return { value: 2 }; },
        };

        const modules = await loadModules(['used'], available);

        expect(modules.get('used')).toEqual({ value: 1 });
        expect(loaded).toBe(1);
    });

    it('names the module that cannot be imported and lists the ones that can', async () => {
        await expect(loadModules(['lodash'], loaders({ react: {}, '@routier/core': {} })))
            .rejects.toThrow('"lodash" is not available in the playground. You can import: @routier/core, react');
    });
});

describe('evaluate', () => {
    it('runs CommonJS output against the loaded modules and returns its exports', () => {
        const modules = new Map<string, ModuleExports>([['math', { double: (n: number) => n * 2 }]]);

        const exports = evaluate('const math = require("math");\nexports.answer = math.double(21);', modules);

        expect(exports.answer).toBe(42);
    });

    it('returns a replaced module.exports', () => {
        expect(evaluate('module.exports = { kind: "replaced" };', new Map()).kind).toBe('replaced');
    });

    it('fails clearly on a module that was not loaded', () => {
        expect(() => evaluate('require("missing");', new Map())).toThrow('"missing" was not loaded');
    });
});
