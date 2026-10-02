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

const time = async (label, fn) => {
    const t = performance.now();
    await fn();
    console.log(`${label}: ${(performance.now() - t).toFixed(2)}ms`);
};

for (const N of [1_000, 10_000, 50_000]) {
    const store = new ItemStore(new MemoryPlugin(`profile-${N}-${Date.now()}`));

    for (let i = 0; i < N; i++) {
        await store.items.addAsync({ name: `item ${i}`, value: i });
    }
    await store.saveChangesAsync();

    const samples = [];
    for (let i = 0; i < 50; i++) {
        const t = performance.now();
        await store.items.addAsync({ name: `post ${i}`, value: N + i });
        await store.saveChangesAsync();
        samples.push(performance.now() - t);
    }
    samples.sort((a, b) => a - b);
    console.log(`N=${N}: single add+save p50=${samples[25].toFixed(3)}ms p95=${samples[47].toFixed(3)}ms`);
}
