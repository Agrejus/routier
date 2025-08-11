import 'fake-indexeddb/auto';

// Simple setup for fake IndexedDB in Node environment
if (typeof global !== 'undefined' && !global.indexedDB) {
    const { indexedDB } = require('fake-indexeddb');
    global.indexedDB = indexedDB;
}
