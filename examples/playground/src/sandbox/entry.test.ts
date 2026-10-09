import { describe, expect, it } from '@jest/globals';
import { entryOf } from './entry';

const Component = () => null;
const run = async (): Promise<void> => undefined;

describe('entryOf', () => {
    it('runs a script that exports run', () => {
        const entry = entryOf({ run, Helper: Component });

        expect(entry.kind).toBe('script');
        expect(entry.kind === 'script' && entry.run).toBe(run);
    });

    it('renders the default export when it is a component', () => {
        const entry = entryOf({ default: Component, Other: () => null });

        expect(entry.kind === 'component' && entry.Component).toBe(Component);
    });

    it('renders the first exported component when there is no default', () => {
        const helper = () => null;
        const entry = entryOf({ helper, TodoApp: Component });

        expect(entry.kind === 'component' && entry.Component).toBe(Component);
    });

    it.each([
        ['nothing', {}],
        ['only values', { count: 3, Title: 'x' }],
        ['only lowercase functions', { helper: () => null }],
        ['only camelCase functions', { renderHelper: () => null }],
    ])('has nothing to run when the module exports %s', (_label, exports) => {
        expect(entryOf(exports).kind).toBe('none');
    });
});
