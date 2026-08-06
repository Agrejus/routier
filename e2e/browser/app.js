// The application under test. Bundled by build.mjs, then loaded by index.html.
//
// Imports '@routier/sqlite-plugin' with no subpath and no driver argument, exactly as a web
// application would. The bundler picks the `browser` condition, so this resolves to the WASM
// build and the default driver is OPFS.
import { DataStore } from '@routier/datastore';
import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import { s } from '@routier/core/schema';

const userSchema = s.define('users', {
    id: s.string().key().identity(),
    name: s.string(),
    age: s.number(),
}).compile();

class AppStore extends DataStore {
    users = this.collection(userSchema).proxy().create();
    constructor() { super(new SqliteDbPlugin('browser-check.sqlite')); }
}

const log = (message) => {
    const element = document.getElementById('out');
    element.textContent += message + '\n';
};

window.routierCheck = async () => {
    const store = new AppStore();

    // Rows left by a previous page load. This is the persistence claim: an OPFS database
    // outlives the page that wrote it.
    const existing = await store.users.toArrayAsync();
    log('rows found at startup: ' + existing.length);

    await store.users.addAsync({ name: 'Ada', age: 36 });
    await store.users.addAsync({ name: 'Grace', age: 45 });
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

    const page = await store.users.sort(u => u.age).skip(1).take(1).toArrayAsync();
    log('sorted page: ' + page.map(u => u.name).join(','));

    return { startupRows: existing.length, afterSave: all.length, adaAge: reread.age };
};

window.routierReset = async () => {
    const store = new AppStore();
    await store.destroyAsync();
    log('destroyed');
};

log('bundle loaded');
document.getElementById('ready').textContent = 'ready';
