import { describe, expect, it } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A program that finishes its work exits.
 *
 * A DataStore opens a BroadcastChannel sender and receiver per collection, and in Node an open
 * channel is a referenced handle. Every script that built a store and did not call
 * `destroyAsync()` therefore ran to the end of its code and then hung forever — including the
 * quick start in the README, which has no `destroyAsync()` in it.
 *
 * Jest never caught this. It tears down its own environment, so a referenced handle shows up
 * as a slow exit or a `--forceExit` in the config rather than as a failure. The only way to
 * observe it is to run a real script in a real process and see whether the process comes back,
 * which is what this does.
 */

const SCRIPT = `
const { DataStore } = require('@routier/datastore');
const { MemoryPlugin } = require('@routier/memory-plugin');
const { s } = require('@routier/core/schema');

const schema = s.define('users', {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

class Ctx extends DataStore {
    users = this.collection(schema).proxy().create();
}

(async () => {
    const ctx = new Ctx(new MemoryPlugin('exit-check'));
    await ctx.users.addAsync({ name: 'Ada' });
    await ctx.saveChangesAsync();
    // Deliberately no destroyAsync(). Cleaning up is what this test refuses to require.
    console.log('done');
})();
`;

describe('a finished program exits', () => {
    it('exits without destroyAsync() being called', () => {
        // Inside the repository, not the system temp directory: Node resolves `require` from
        // the script's own location, and a script in /tmp cannot see these packages at all.
        const directory = mkdtempSync(join(__dirname, 'exit-check-'));
        const file = join(directory, 'script.cjs');

        try {
            writeFileSync(file, SCRIPT);

            // `timeout` kills the child rather than the runner, so a regression fails here as
            // a non-zero exit instead of hanging the whole suite.
            //
            // The error it throws carries a circular reference that Jest's worker cannot
            // serialise, which turns a clear failure into "Test suite failed to run". Reading
            // the fields that matter and asserting on those keeps the message useful.
            let output = '';
            let failure = '';

            try {
                output = execFileSync(process.execPath, [file], {
                    encoding: 'utf8',
                    timeout: 20_000,
                });
            } catch (error) {
                const { code, signal } = error as { code?: string; signal?: string };

                failure = signal === 'SIGTERM' || code === 'ETIMEDOUT'
                    ? 'the process did not exit: a handle is still referenced after the work finished'
                    : `the process failed: ${code ?? signal ?? 'unknown'}`;
            }

            expect(failure).toBe('');
            expect(output).toContain('done');
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
});
