import { afterEach, describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import type { IDbPlugin } from '@routier/core/plugins';
import { EncryptionDbPlugin, createKeyring, isEnvelope } from '../index';

/**
 * Encrypting properties that are not strings.
 *
 * A ciphertext is text, so an encrypted number cannot live in the column its own schema would
 * produce. The wrapper hands the inner plugin a view of the schema in which those properties
 * say `String`, and every backend then builds a TEXT column through unmodified code.
 *
 * SQLite is in this list on purpose: it is the one that would reveal the column type being
 * wrong, because a REAL column holding a base64 envelope is exactly the sort of thing an
 * engine either coerces silently or rejects.
 */

const recordSchema = s.define('records', {
    id: s.string().key().identity(),
    label: s.string(),
    salary: s.number().encrypted(),
    bornOn: s.date().encrypted(),
    active: s.boolean().encrypted(),
    profile: s.object({ city: s.string(), score: s.number() }).encrypted(),
}).compile();

class RecordStore extends DataStore {
    records = this.collection(recordSchema).proxy().create();
}

const stores: DataStore[] = [];
const files: string[] = [];

const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
    files.splice(0);
});

const secret = () => crypto.getRandomValues(new Uint8Array(32));
const keyring = () => createKeyring({ activeKeyId: 'k1', keys: { k1: secret() } });

const databases: [string, () => IDbPlugin][] = [
    ['memory', () => new MemoryPlugin(`types-${uuidv4()}`)],
    ['dexie', () => new DexiePlugin(`types-${uuidv4()}`)],
    ['sqlite', () => {
        const file = `enc-types-${uuidv4()}.sqlite`;
        files.push(file);
        return new SqliteDbPlugin(file);
    }],
];

const BORN = new Date(Date.UTC(1990, 4, 17));

describe('encrypting non-string properties', () => {

    describe.each(databases)('with the %s database', (_name, plugin) => {

        it('round-trips a number, a date, a boolean and an object', async () => {
            const store = track(new RecordStore(new EncryptionDbPlugin(plugin(), await keyring())));

            await store.records.addAsync({
                label: 'ada',
                salary: 125000.5,
                bornOn: BORN,
                active: true,
                profile: { city: 'London', score: 9.5 },
            } as never);
            await store.saveChangesAsync();

            // No casts: `encrypted()` leaves the inferred types alone, so `salary` is a
            // number and `bornOn` a Date to the application.
            const [saved] = await store.records.toArrayAsync();

            // Types, not just values: a number must come back a number.
            expect(saved.salary).toBe(125000.5);
            expect(typeof saved.salary).toBe('number');

            expect(new Date(saved.bornOn).toISOString()).toBe(BORN.toISOString());

            expect(saved.active).toBe(true);
            expect(typeof saved.active).toBe('boolean');

            expect(saved.profile).toEqual({ city: 'London', score: 9.5 });
        });

        it('keeps false and zero, which a truthiness bug would lose', async () => {
            const store = track(new RecordStore(new EncryptionDbPlugin(plugin(), await keyring())));

            await store.records.addAsync({
                label: 'edge', salary: 0, bornOn: BORN, active: false,
                profile: { city: '', score: 0 },
            } as never);
            await store.saveChangesAsync();

            const [saved] = await store.records.toArrayAsync();

            expect(saved.salary).toBe(0);
            expect(saved.active).toBe(false);
        });

        it('updates an encrypted number', async () => {
            const store = track(new RecordStore(new EncryptionDbPlugin(plugin(), await keyring())));

            await store.records.addAsync({
                label: 'x', salary: 1, bornOn: BORN, active: true, profile: { city: 'a', score: 1 },
            } as never);
            await store.saveChangesAsync();

            const [record] = await store.records.toArrayAsync();
            record.salary = 2;
            await store.saveChangesAsync();

            const [reread] = await store.records.toArrayAsync();

            expect(reread.salary).toBe(2);
        });
    });

    describe('what the backend actually holds', () => {

        it('stores every encrypted property as a ciphertext string', async () => {
            const inner = new MemoryPlugin(`raw-types-${uuidv4()}`);
            const store = track(new RecordStore(new EncryptionDbPlugin(inner, await keyring())));

            await store.records.addAsync({
                label: 'ada', salary: 125000.5, bornOn: BORN, active: true,
                profile: { city: 'London', score: 9.5 },
            } as never);
            await store.saveChangesAsync();

            const rows = Object.values(
                (inner as unknown as { database: Record<string, { data: Map<string, Record<string, unknown>> }> }).database
            ).flatMap(collection => [...collection.data.values()]);

            expect(rows).toHaveLength(1);

            const [row] = rows;

            for (const name of ['salary', 'bornOn', 'active', 'profile']) {
                expect(isEnvelope(row[name])).toBe(true);
            }

            const serialised = JSON.stringify(row);
            expect(serialised).not.toContain('125000.5');
            expect(serialised).not.toContain('London');
            expect(row.label).toBe('ada');
        });
    });
});
