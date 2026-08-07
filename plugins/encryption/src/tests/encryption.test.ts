import { afterEach, describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DexiePlugin } from '@routier/dexie-plugin';
import type { IDbPlugin } from '@routier/core/plugins';
import { EncryptionDbPlugin, createKeyring, encrypted, isEnvelope } from '../index';

/**
 * Field-level encryption, end to end.
 *
 * The assertions that matter are not "it round-trips" — that would pass with a plugin that
 * stored plaintext. They are the ones that read what actually reached the backend and check
 * the plaintext is not in it.
 */

const userSchema = s.define('users', {
    id: s.string().key().identity(),
    tenant: s.string().index(),
    email: encrypted(s.string(), { searchable: true }),
    notes: encrypted(s.string()),
    plain: s.string(),
}).compile();

class UserStore extends DataStore {
    users = this.collection(userSchema).proxy().create();
}

const stores: DataStore[] = [];

const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

const secret = () => crypto.getRandomValues(new Uint8Array(32));

const keyring = () => createKeyring({ activeKeyId: 'k1', keys: { k1: secret() } });

const databases: [string, () => IDbPlugin][] = [
    ['memory', () => new MemoryPlugin(`enc-${uuidv4()}`)],
    ['dexie', () => new DexiePlugin(`enc-${uuidv4()}`)],
];

describe('encryption', () => {

    describe.each(databases)('with the %s database', (_name, plugin) => {

        const build = async () => {
            const store = track(new UserStore(new EncryptionDbPlugin(plugin(), await keyring())));
            return store as UserStore;
        };

        it('gives back the plaintext it was given', async () => {
            const store = await build();

            await store.users.addAsync({
                tenant: 't1', email: 'ada@example.com', notes: 'confidential', plain: 'visible',
            });
            await store.saveChangesAsync();

            const [saved] = await store.users.toArrayAsync();

            expect(saved.email).toBe('ada@example.com');
            expect(saved.notes).toBe('confidential');
            expect(saved.plain).toBe('visible');
        });

        it('finds a row by an encrypted value it can search', async () => {
            const store = await build();

            await store.users.addAsync({ tenant: 't1', email: 'ada@example.com', notes: 'a', plain: 'p' });
            await store.users.addAsync({ tenant: 't1', email: 'grace@example.com', notes: 'b', plain: 'p' });
            await store.saveChangesAsync();

            const found = await store.users
                .where(([u, p]) => u.email === p.email, { email: 'grace@example.com' })
                .toArrayAsync();

            expect(found).toHaveLength(1);
            expect(found[0].email).toBe('grace@example.com');
            expect(found[0].notes).toBe('b');
        });

        it('refuses to filter a property it cannot search', async () => {
            const store = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'secret', plain: 'p' });
            await store.saveChangesAsync();

            await expect(
                store.users.where(([u, p]) => u.notes === p.notes, { notes: 'secret' }).toArrayAsync()
            ).rejects.toThrow(/cannot be filtered/);
        });

        it('refuses an ordering comparison even on a searchable property', async () => {
            // A ciphertext does not sort like its plaintext, so a range comparison would
            // return rows that look right and are not.
            const store = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', plain: 'p' });
            await store.saveChangesAsync();

            await expect(
                store.users.where(([u, p]) => u.email > p.email, { email: 'a' }).toArrayAsync()
            ).rejects.toThrow(/only an equality comparison/);
        });

        it('leaves unencrypted properties queryable', async () => {
            const store = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', plain: 'p' });
            await store.users.addAsync({ tenant: 't2', email: 'd@e.f', notes: 'n', plain: 'p' });
            await store.saveChangesAsync();

            const found = await store.users
                .where(([u, p]) => u.tenant === p.tenant, { tenant: 't2' })
                .toArrayAsync();

            expect(found).toHaveLength(1);
            expect(found[0].email).toBe('d@e.f');
        });

        it('updates an encrypted value in place', async () => {
            const store = await build();

            await store.users.addAsync({ tenant: 't1', email: 'old@example.com', notes: 'n', plain: 'p' });
            await store.saveChangesAsync();

            const [user] = await store.users.toArrayAsync();
            user.email = 'new@example.com';
            await store.saveChangesAsync();

            const [reread] = await store.users.toArrayAsync();

            expect(reread.email).toBe('new@example.com');
        });

        it('does not encrypt an already-encrypted value a second time', async () => {
            // An entity read back and saved again must not be wrapped twice, which would
            // leave a value nothing can read without decrypting in layers.
            const store = await build();

            await store.users.addAsync({ tenant: 't1', email: 'a@b.c', notes: 'n', plain: 'p' });
            await store.saveChangesAsync();

            const [user] = await store.users.toArrayAsync();
            user.plain = 'touched';
            await store.saveChangesAsync();

            const [reread] = await store.users.toArrayAsync();

            expect(reread.email).toBe('a@b.c');
            expect(reread.notes).toBe('n');
        });
    });

    describe('rewriting a filter', () => {

        it('refuses a param compared against both an encrypted and a plain property', async () => {
            /**
             * A filter reaches a plugin twice: as an expression a translator walks, and as the
             * original lambda an in-process plugin calls with its params. Both are rewritten,
             * and params are matched by VALUE because a value expression does not record which
             * param it came from.
             *
             * So one value used on both sides is genuinely ambiguous — the encrypted
             * comparison needs the ciphertext and the plain one needs the plaintext. It throws
             * rather than picking one and silently breaking the other.
             */
            const store = track(new UserStore(
                new EncryptionDbPlugin(new MemoryPlugin(`ambiguous-${uuidv4()}`), await keyring())
            ));

            await store.users.addAsync({ tenant: 'shared', email: 'shared', notes: 'n', plain: 'p' });
            await store.saveChangesAsync();

            await expect(
                store.users
                    .where(([u, p]) => u.email === p.value && u.tenant === p.value, { value: 'shared' })
                    .toArrayAsync()
            ).rejects.toThrow(/compared against both an encrypted property and an unencrypted one/);
        });

        it('leaves a plain param alone while encrypting the other', async () => {
            const store = track(new UserStore(
                new EncryptionDbPlugin(new MemoryPlugin(`mixed-${uuidv4()}`), await keyring())
            ));

            await store.users.addAsync({ tenant: 't1', email: 'ada@example.com', notes: 'n', plain: 'p' });
            await store.users.addAsync({ tenant: 't2', email: 'ada@example.com', notes: 'n', plain: 'p' });
            await store.saveChangesAsync();

            const found = await store.users
                .where(([u, p]) => u.email === p.email && u.tenant === p.tenant,
                    { email: 'ada@example.com', tenant: 't2' })
                .toArrayAsync();

            expect(found).toHaveLength(1);
            expect(found[0].tenant).toBe('t2');
        });
    });

    describe('what actually reaches the database', () => {

        /**
         * The records the memory plugin actually holds, read behind the wrapper's back.
         *
         * Reaches into `database`, which is private, and into each collection's `data` Map,
         * which is protected. That is the point: a test that went through the plugin's own
         * read path would be decrypted on the way out and would prove nothing.
         *
         * `records` is not used because it returns a copy, so it cannot be tampered with.
         */
        const collectionsOf = (plugin: MemoryPlugin) => Object.values(
            (plugin as unknown as { database: Record<string, { data: Map<string, Record<string, unknown>> }> }).database
        );

        const storedRows = (plugin: MemoryPlugin) =>
            collectionsOf(plugin).flatMap(collection => [...collection.data.values()]);

        it('stores ciphertext, not the value', async () => {
            const inner = new MemoryPlugin(`raw-${uuidv4()}`);
            const store = track(new UserStore(new EncryptionDbPlugin(inner, await keyring())));

            await store.users.addAsync({
                tenant: 't1', email: 'ada@example.com', notes: 'confidential', plain: 'visible',
            });
            await store.saveChangesAsync();

            const rows = storedRows(inner);

            // Guard against the assertions below passing because nothing was read.
            expect(rows).toHaveLength(1);

            const [row] = rows;

            expect(isEnvelope(row.email)).toBe(true);
            expect(isEnvelope(row.notes)).toBe(true);

            // The plaintext appears nowhere in the stored record.
            const serialised = JSON.stringify(row);
            expect(serialised).not.toContain('ada@example.com');
            expect(serialised).not.toContain('confidential');

            // And the property that was not marked is untouched.
            expect(row.plain).toBe('visible');
            expect(row.tenant).toBe('t1');
        });

        it('gives the same value the same ciphertext when searchable, and not otherwise', async () => {
            // The whole trade, made visible. A searchable property leaks equality; a
            // randomised one does not.
            const inner = new MemoryPlugin(`modes-${uuidv4()}`);
            const store = track(new UserStore(new EncryptionDbPlugin(inner, await keyring())));

            await store.users.addAsync({ tenant: 't', email: 'same@x.com', notes: 'same note', plain: 'p' });
            await store.users.addAsync({ tenant: 't', email: 'same@x.com', notes: 'same note', plain: 'p' });
            await store.saveChangesAsync();

            const rows = storedRows(inner);

            expect(rows).toHaveLength(2);

            const [first, second] = rows;

            // Deterministic: equal plaintext, equal ciphertext. This is what makes the
            // equality filter work, and what an attacker can see.
            expect(first.email).toBe(second.email);

            // Randomised: equal plaintext, different ciphertext. Nothing leaks.
            expect(first.notes).not.toBe(second.notes);
        });
    });

    describe('keys', () => {

        it('reads a value written with a retired key', async () => {
            const oldSecret = secret();
            const newSecret = secret();
            const inner = new MemoryPlugin(`rotate-${uuidv4()}`);

            const before = await createKeyring({ activeKeyId: 'k1', keys: { k1: oldSecret } });
            const first = track(new UserStore(new EncryptionDbPlugin(inner, before)));

            await first.users.addAsync({ tenant: 't', email: 'a@b.c', notes: 'written with k1', plain: 'p' });
            await first.saveChangesAsync();

            // Rotate: k2 becomes active, k1 stays readable.
            const after = await createKeyring({ activeKeyId: 'k2', keys: { k1: oldSecret, k2: newSecret } });
            const second = track(new UserStore(new EncryptionDbPlugin(inner, after)));

            const [row] = await second.users.toArrayAsync();

            expect(row.notes).toBe('written with k1');
        });

        it('says which key is missing rather than failing obscurely', async () => {
            const inner = new MemoryPlugin(`missing-${uuidv4()}`);

            const original = await createKeyring({ activeKeyId: 'k1', keys: { k1: secret() } });
            const first = track(new UserStore(new EncryptionDbPlugin(inner, original)));

            await first.users.addAsync({ tenant: 't', email: 'a@b.c', notes: 'n', plain: 'p' });
            await first.saveChangesAsync();

            // k1 dropped from the keyring while rows still reference it.
            const without = await createKeyring({ activeKeyId: 'k2', keys: { k2: secret() } });
            const second = track(new UserStore(new EncryptionDbPlugin(inner, without)));

            await expect(second.users.toArrayAsync()).rejects.toThrow(/No key 'k1' in the keyring/);
        });

        it('reports a wrong key rather than returning rubbish', async () => {
            const inner = new MemoryPlugin(`wrong-${uuidv4()}`);

            const right = await createKeyring({ activeKeyId: 'k1', keys: { k1: secret() } });
            const first = track(new UserStore(new EncryptionDbPlugin(inner, right)));

            await first.users.addAsync({ tenant: 't', email: 'a@b.c', notes: 'n', plain: 'p' });
            await first.saveChangesAsync();

            // Same id, different material. AES-GCM authenticates, so this is detected.
            const wrong = await createKeyring({ activeKeyId: 'k1', keys: { k1: secret() } });
            const second = track(new UserStore(new EncryptionDbPlugin(inner, wrong)));

            await expect(second.users.toArrayAsync()).rejects.toThrow(/Could not decrypt/);
        });

        it('refuses a key that is too short to be a key', async () => {
            await expect(createKeyring({ activeKeyId: 'k', keys: { k: new Uint8Array(8) } }))
                .rejects.toThrow(/at least 32 bytes/);
        });

        it('refuses an active id that is not in the keyring', async () => {
            await expect(createKeyring({ activeKeyId: 'missing', keys: { k1: secret() } }))
                .rejects.toThrow(/not in the keyring/);
        });

        it('refuses a key id that would break the envelope', async () => {
            // Ids are stored verbatim and delimited by '.', so one containing a dot would
            // produce a value that cannot be parsed back.
            await expect(createKeyring({ activeKeyId: 'a.b', keys: { 'a.b': secret() } }))
                .rejects.toThrow(/not a usable key id/);
        });
    });

    describe('a tampered value', () => {

        it('is rejected rather than decrypted', async () => {
            // AES-GCM authenticates as well as encrypts. Someone with write access to the
            // database cannot alter a field and have it read back as anything at all.
            const inner = new MemoryPlugin(`tamper-${uuidv4()}`);
            const store = track(new UserStore(new EncryptionDbPlugin(inner, await keyring())));

            await store.users.addAsync({ tenant: 't', email: 'a@b.c', notes: 'original', plain: 'p' });
            await store.saveChangesAsync();

            let tampered = 0;

            for (const collection of Object.values(
                (inner as unknown as { database: Record<string, { data: Map<string, Record<string, unknown>> }> }).database
            )) {
                for (const record of collection.data.values()) {
                    const envelope = record.notes as string;
                    // Flip the last character of the ciphertext.
                    record.notes = envelope.slice(0, -1) + (envelope.endsWith('A') ? 'B' : 'A');
                    tampered++;
                }
            }

            // Or the rejection below would prove nothing.
            expect(tampered).toBe(1);

            await expect(store.users.toArrayAsync()).rejects.toThrow(/Could not decrypt/);
        });
    });

});
