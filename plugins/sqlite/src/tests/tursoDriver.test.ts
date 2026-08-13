import { describe, expect, it } from '@jest/globals';
import { LibsqlClientLike, tursoDriver } from '../drivers/turso';

/**
 * The transaction mapping, against a client that records what it was asked to do.
 *
 * This is the whole reason the driver is more than a passthrough. libSQL over HTTP is
 * stateless per `execute`, so a `BEGIN` sent that way opens a transaction the following
 * statements never join — they commit individually and a later `ROLLBACK` undoes nothing.
 * Nothing errors, which is what makes it worth pinning: the failure only shows up as a
 * half-written database after a save fails.
 *
 * A recording fake is the right tool here. The question is not "does libSQL work" but "does
 * this driver route statements into the open transaction", and that is answerable by looking
 * at where each statement was sent.
 */

type Recorded = { target: 'client' | 'transaction'; sql: string; args: unknown[] };

const fakeClient = () => {
    const recorded: Recorded[] = [];
    const state = { opened: 0, committed: 0, rolledBack: 0, mode: null as string | null };

    const client: LibsqlClientLike = {
        async execute(statement) {
            recorded.push({ target: 'client', sql: statement.sql, args: statement.args });
            return { rows: [] };
        },
        async transaction(mode) {
            state.opened += 1;
            state.mode = mode;

            return {
                async execute(statement) {
                    recorded.push({ target: 'transaction', sql: statement.sql, args: statement.args });
                    return { rows: [] };
                },
                async commit() { state.committed += 1; },
                async rollback() { state.rolledBack += 1; },
                close() { /* no-op */ },
            };
        },
        close() { /* no-op */ },
    };

    return { client, recorded, state };
};

describe('turso driver', () => {

    describe('transaction control', () => {

        it('opens an interactive transaction on BEGIN IMMEDIATE', async () => {
            const { client, state } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('BEGIN IMMEDIATE TRANSACTION');

            expect(state.opened).toBe(1);
            // "write" rather than "deferred": BEGIN IMMEDIATE takes the write lock up front,
            // and deferring it moves a lock conflict to a later statement.
            expect(state.mode).toBe('write');
        });

        /**
         * The defect this driver exists to prevent. Sent through `client.execute`, these
         * writes would commit individually and survive a rollback.
         */
        it('routes statements into the open transaction, not the client', async () => {
            const { client, recorded } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('BEGIN IMMEDIATE TRANSACTION');
            await connection.run('INSERT INTO t (a) VALUES (?)', [1]);
            await connection.all('SELECT * FROM t WHERE a = ?', [1]);

            expect(recorded.map(r => r.target)).toEqual(['transaction', 'transaction']);
        });

        it('sends statements to the client when no transaction is open', async () => {
            const { client, recorded } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.all('SELECT 1');

            expect(recorded).toEqual([{ target: 'client', sql: 'SELECT 1', args: [] }]);
        });

        it('commits and clears the transaction', async () => {
            const { client, recorded, state } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('BEGIN IMMEDIATE TRANSACTION');
            await connection.run('INSERT INTO t (a) VALUES (?)', [1]);
            await connection.run('COMMIT');
            await connection.run('INSERT INTO t (a) VALUES (?)', [2]);

            expect(state.committed).toBe(1);
            // The second insert is after the commit, so it belongs to the client again.
            expect(recorded.map(r => r.target)).toEqual(['transaction', 'client']);
        });

        it('rolls back and clears the transaction', async () => {
            const { client, state } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('BEGIN IMMEDIATE TRANSACTION');
            await connection.run('ROLLBACK');

            expect(state.rolledBack).toBe(1);
        });

        /**
         * The plugin rolls back on the way out of a failed save, and the failure may have
         * been the BEGIN itself — so a rollback with nothing open must not raise a second
         * error over the first.
         */
        it('tolerates a ROLLBACK with no transaction open', async () => {
            const { client, state } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await expect(connection.run('ROLLBACK')).resolves.toBeUndefined();
            expect(state.rolledBack).toBe(0);
        });

        it('refuses a nested BEGIN rather than losing the outer transaction', async () => {
            const { client } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('BEGIN IMMEDIATE TRANSACTION');

            await expect(connection.run('BEGIN')).rejects.toThrow(/already open/);
        });

        it('rejects COMMIT with no transaction open', async () => {
            const { client } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await expect(connection.run('COMMIT')).rejects.toThrow(/no open transaction/);
        });
    });

    describe('statement classification', () => {

        /**
         * Matched on the FIRST word, anchored. A statement that merely contains the word is
         * an ordinary statement — mistaking one for transaction control would silently drop
         * a write, since the driver would not execute it at all.
         */
        it.each([
            ['INSERT INTO commits (sha) VALUES (?)'],
            ['SELECT * FROM rollback_log'],
            [`INSERT INTO audit (action) VALUES ('rollback')`],
            ['UPDATE t SET note = ? WHERE note = ?'],
        ])('treats %s as an ordinary statement', async (sql) => {
            const { client, recorded, state } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run(sql, []);

            expect(state.opened).toBe(0);
            expect(recorded).toHaveLength(1);
            expect(recorded[0].sql).toBe(sql);
        });

        it('recognises transaction control regardless of case or leading space', async () => {
            const { client, state } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('  begin immediate transaction  ');
            await connection.run('  commit  ');

            expect(state.opened).toBe(1);
            expect(state.committed).toBe(1);
        });
    });

    describe('close', () => {

        it('rolls an unfinished transaction back rather than leaving the lock held', async () => {
            const { client, state } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('BEGIN IMMEDIATE TRANSACTION');
            await connection.close();

            expect(state.rolledBack).toBe(1);
        });

        /**
         * The plugin opens and closes a connection per operation. Closing the caller's
         * client on the first one would break every operation after it.
         */
        it('does not close the client, whose lifetime belongs to the caller', async () => {
            let closed = false;
            const { client } = fakeClient();
            client.close = () => { closed = true; };

            const connection = await tursoDriver(client).open('ignored');
            await connection.close();

            expect(closed).toBe(false);
        });
    });

    describe('parameters', () => {

        it('normalises undefined to null, as every other driver does', async () => {
            const { client, recorded } = fakeClient();
            const connection = await tursoDriver(client).open('ignored');

            await connection.run('INSERT INTO t (a, b) VALUES (?, ?)', [1, undefined]);

            expect(recorded[0].args).toEqual([1, null]);
        });
    });

    describe('deleteDatabase', () => {

        it('refuses, naming what to do instead', async () => {
            const { client } = fakeClient();

            await expect(tursoDriver(client).deleteDatabase('anything'))
                .rejects.toThrow(/provisioned out of band/);
        });
    });
});
