import { describe, it } from '@jest/globals';
import { vmModulesEnabled } from '@routier/test-utils';

/**
 * Registers a suite only where PGlite can actually run.
 *
 * PGlite reaches its filesystems through dynamic imports, which need
 * `--experimental-vm-modules`. `npm test -w @routier/pglite-plugin` sets that flag; the
 * repo-wide `npm test` does not. Registering a skipped suite rather than nothing, because a
 * file that registers no tests at all fails as an empty suite.
 */
export const whenPGliteCanRun = (name: string, register: () => void): void => {
    if (vmModulesEnabled) {
        register();
        return;
    }

    describe.skip(name, () => {
        // Annotated because tsc emits TS7011 on a bare `() => undefined` here.
        it('needs --experimental-vm-modules', (): void => undefined);
    });
};
