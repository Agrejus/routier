import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';

const itemSchema = s.define('items', {
    _id: s.string().key().identity(),
    name: s.string(),
    value: s.number(),
}).compile();

class ItemStore extends DataStore {
    items = this.collection(itemSchema).proxy().create();
}

const store = new ItemStore(new MemoryPlugin(`profile-${Date.now()}`));
for (let i = 0; i < 50_000; i++) {
    await store.items.addAsync({ name: `item ${i}`, value: i });
}
await store.saveChangesAsync();

console.error('seeded, profiling 200 single saves');
const t = performance.now();
for (let i = 0; i < 200; i++) {
    await store.items.addAsync({ name: `post ${i}`, value: 50_000 + i });
    await store.saveChangesAsync();
}
console.error(`200 saves: ${(performance.now() - t).toFixed(0)}ms`);
