import { describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { uuidv4 } from '@routier/core';

/**
 * `tag()` is metadata and must not change an entity's type.
 *
 * `SchemaTag<T>` carries the same `T` as whatever it wrapped, without carrying which class
 * that was, and only the `SchemaObject` branch of `InferPrimitive` knows how to unwrap a map
 * of child schemas. A tagged object therefore typed its children as `SchemaString` rather
 * than `string` — the code ran correctly and only the types were wrong, which is why nothing
 * caught it until the blob plugin needed a tagged property.
 *
 * Every assertion here is the plain typed assignment. A regression fails at compile time.
 */
const schema = s.define('tagged', {
    id: s.string().key().identity(),
    text: s.string().tag('a'),
    count: s.number().tag('a'),
    flag: s.boolean().tag('a'),
    when: s.date().tag('a'),
    list: s.array(s.string()).tag('a'),
    nested: s.object({ key: s.string(), size: s.number() }).tag('a'),
}).compile();

class Store extends DataStore { rows = this.collection(schema).proxy().create(); }

describe('tag() and inferred types', () => {
    it('leaves every property type unchanged', async () => {
        const store = new Store(new MemoryPlugin(`tag-${uuidv4()}`));

        await store.rows.addAsync({
            text: 't', count: 1, flag: true, when: new Date(0),
            list: ['a'], nested: { key: 'k', size: 2 },
        } as never);
        await store.saveChangesAsync();

        const [row] = await store.rows.toArrayAsync();

        // No casts anywhere. These assignments are the test.
        const text: string = row.text;
        const count: number = row.count;
        const flag: boolean = row.flag;
        const when: Date = row.when;
        const list: string[] = row.list;
        const key: string = row.nested.key;
        const size: number = row.nested.size;

        expect([text, count, flag, list, key, size]).toEqual(['t', 1, true, ['a'], 'k', 2]);
        expect(when).toBeInstanceOf(Date);

        await store.destroyAsync();
    });
});
