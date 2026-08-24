// The PGlite fixture. Bundled by build.mjs, then loaded by pglite.html.
//
// Imports '@routier/pglite-plugin' with no subpath and no options, exactly as a web
// application would. The bundler picks the `browser` condition, so this resolves to the
// worker-backed build and the data directory defaults to opfs-ahp://.
import { DataStore } from '@routier/datastore';
import { PGliteDbPlugin } from '@routier/pglite-plugin';
import { s } from '@routier/core/schema';

const userSchema = s.define('browser_users', {
    id: s.string().key().identity(),
    name: s.string(),
    age: s.number(),
    detail: s.object({ note: s.string() }),
}).compile();

class AppStore extends DataStore {
    users = this.collection(userSchema).proxy().create();
    constructor() { super(new PGliteDbPlugin('routier-browser-check')); }
}

const log = (message) => {
    document.getElementById('out').textContent += message + '\n';
};

window.routierCheck = async () => {
    const store = new AppStore();

    // Rows left by a previous page load. This is the persistence claim: an OPFS database
    // outlives the page that wrote it.
    const existing = await store.users.toArrayAsync();
    log('rows found at startup: ' + existing.length);

    await store.users.addAsync({ name: 'Ada', age: 36, detail: { note: 'first' } });
    await store.users.addAsync({ name: 'Grace', age: 45, detail: { note: 'second' } });
    await store.saveChangesAsync();

    const all = await store.users.toArrayAsync();
    log('rows after save: ' + all.length);

    const older = await store.users
        .where(([u, p]) => u.age > p.min, { min: 40 })
        .toArrayAsync();
    log('filtered (age > 40): ' + older.map(u => u.name).join(','));

    const ada = all.find(u => u.name === 'Ada');
    ada.age = 37;
    await store.saveChangesAsync();

    const reread = await store.users
        .where(([u, p]) => u.name === p.n, { n: 'Ada' })
        .firstAsync();
    log('after update, Ada.age = ' + reread.age);

    // JSONB, which is the column type a browser SQLite database does not have. Proves the
    // nested value came back as a structure and not as a string.
    log('nested note: ' + reread.detail.note);

    const page = await store.users.sort(u => u.age).skip(1).take(1).toArrayAsync();
    log('sorted page: ' + page.map(u => u.name).join(','));

    return {
        startupRows: existing.length,
        afterSave: all.length,
        adaAge: reread.age,
        nestedNote: reread.detail.note,
    };
};

/**
 * Empties the tables.
 *
 * NOT `destroyAsync()`, which on a PostgreSQL plugin closes the database and leaves the data —
 * that is the documented contract, and it is why this fixture clears rows instead.
 */
window.routierReset = async () => {
    const store = new AppStore();
    const all = await store.users.toArrayAsync();

    if (all.length > 0) {
        await store.users.removeAsync(...all);
        await store.saveChangesAsync();
    }

    log('cleared ' + all.length + ' rows');
};

log('bundle loaded');
document.getElementById('ready').textContent = 'ready';
