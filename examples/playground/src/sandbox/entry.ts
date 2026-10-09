import type { ComponentType } from 'react';
import type { ModuleExports, ModuleValue } from './execute';

export type Log = (message: string, value?: ModuleValue) => void;

export type Run = (log: Log) => Promise<void> | void;

export type Entry =
    | { kind: 'script'; run: Run }
    | { kind: 'component'; Component: ComponentType }
    | { kind: 'none' };

const isRun = (value: ModuleValue): value is Run => typeof value === 'function';

const isComponent = (value: ModuleValue): value is ComponentType => typeof value === 'function';

const startsUppercase = (name: string): boolean => /^[A-Z]/.test(name);

export const entryOf = (exports: ModuleExports): Entry => {
    const { run } = exports;

    if (isRun(run)) {
        return { kind: 'script', run };
    }

    const candidates: [string, ModuleValue][] = [['Default', exports.default], ...Object.entries(exports)];
    const found = candidates.find(([name, value]) => startsUppercase(name) && isComponent(value));

    return found !== undefined && isComponent(found[1]) ? { kind: 'component', Component: found[1] } : { kind: 'none' };
};
