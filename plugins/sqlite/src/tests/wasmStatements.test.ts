import { describe, it, expect, jest } from '@jest/globals';
import { acquireStatement, releaseStatement, STATEMENT_CACHE_MAX, type PreparingDatabase, type ReusableStatement } from '../drivers/wasmStatements';

const createStatement = (): ReusableStatement => ({
    bind: jest.fn(),
    getColumnNames: jest.fn(() => [] as string[]),
    finalize: jest.fn(),
    reset: jest.fn(),
    clearBindings: jest.fn(),
    pointer: 0,
});

const createDatabase = () => {
    const prepared: ReusableStatement[] = [];
    const database: PreparingDatabase = {
        prepare: jest.fn((_sql: string) => {
            const statement = createStatement();
            prepared.push(statement);
            return statement;
        }),
    };
    return { database, prepared };
};

describe('wasmStatements', () => {
    it('prepares a statement once and reuses it for the same sql', () => {
        const { database } = createDatabase();

        const first = acquireStatement(database, 'SELECT 1');
        releaseStatement(database, 'SELECT 1', first);
        const second = acquireStatement(database, 'SELECT 1');

        expect(second).toBe(first);
        expect(database.prepare).toHaveBeenCalledTimes(1);
    });

    it('prepares separately per sql text and per database', () => {
        const { database } = createDatabase();
        const { database: other } = createDatabase();

        const a = acquireStatement(database, 'SELECT 1');
        const b = acquireStatement(database, 'SELECT 2');
        const c = acquireStatement(other, 'SELECT 1');

        expect(a).not.toBe(b);
        expect(a).not.toBe(c);
        expect(database.prepare).toHaveBeenCalledTimes(2);
        expect(other.prepare).toHaveBeenCalledTimes(1);
    });

    it('resets and clears bindings on release instead of finalizing', () => {
        const { database } = createDatabase();

        const statement = acquireStatement(database, 'SELECT 1');
        releaseStatement(database, 'SELECT 1', statement);

        expect(statement.reset).toHaveBeenCalledTimes(1);
        expect(statement.clearBindings).toHaveBeenCalledTimes(1);
        expect(statement.finalize).not.toHaveBeenCalled();
    });

    it('finalizes the least recently used statement when the cache is full', () => {
        const { database, prepared } = createDatabase();

        for (let i = 0; i <= STATEMENT_CACHE_MAX; i++) {
            acquireStatement(database, `SELECT ${i}`);
        }

        expect(prepared[0].finalize).toHaveBeenCalledTimes(1);
        expect(prepared[1].finalize).not.toHaveBeenCalled();

        acquireStatement(database, 'SELECT 0');
        expect(database.prepare).toHaveBeenCalledTimes(STATEMENT_CACHE_MAX + 2);
    });

    it('keeps a reused statement alive by bumping it ahead of eviction', () => {
        const { database, prepared } = createDatabase();

        for (let i = 0; i < STATEMENT_CACHE_MAX; i++) {
            acquireStatement(database, `SELECT ${i}`);
        }

        acquireStatement(database, 'SELECT 0');
        acquireStatement(database, 'SELECT fresh');

        expect(prepared[0].finalize).not.toHaveBeenCalled();
        expect(prepared[1].finalize).toHaveBeenCalledTimes(1);
    });

    it('evicts and finalizes a statement whose reset throws, then rethrows', () => {
        const { database } = createDatabase();

        const statement = acquireStatement(database, 'SELECT 1');
        (statement.reset as jest.Mock).mockImplementation(() => { throw new Error('reset failed'); });

        expect(() => releaseStatement(database, 'SELECT 1', statement)).toThrow('reset failed');
        expect(statement.finalize).toHaveBeenCalledTimes(1);

        const replacement = acquireStatement(database, 'SELECT 1');
        expect(replacement).not.toBe(statement);
        expect(database.prepare).toHaveBeenCalledTimes(2);
    });

    it('swallows a finalize failure while discarding a broken statement', () => {
        const { database } = createDatabase();

        const statement = acquireStatement(database, 'SELECT 1');
        (statement.reset as jest.Mock).mockImplementation(() => { throw new Error('reset failed'); });
        (statement.finalize as jest.Mock).mockImplementation(() => { throw new Error('finalize failed'); });

        expect(() => releaseStatement(database, 'SELECT 1', statement)).toThrow('reset failed');
    });
});
