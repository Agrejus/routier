import { describe, expect, it } from '@jest/globals';
import { s, SchemaTypes } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `.fullTextSearch()` — the declaration, its validation, and the schema it generates.
 *
 * Nothing here indexes anything yet; maintenance is a later step. What is pinned is the shape
 * of the generated index collection and every way the declaration can be wrong, because those
 * are the parts a later step depends on and cannot re-derive.
 */

const articleSchema = s.define('fts_articles', {
    id: s.string().key().identity(),
    title: s.string().searchable(),
    body: s.string({ maxLength: 4000 }).searchable(),
    authorNote: s.string(),
}).compile();

class Store extends DataStore {
    articles = this.collection(articleSchema)
        .fullTextSearch()
        .proxy()
        .create();
}

const createStore = () => new Store(new MemoryPlugin(`fts-${Math.random()}`));

describe('fullTextSearch declaration', () => {

    it('registers the collection', () => {
        const store = createStore();
        const registration = (store as never as {
            _fullTextSearches: { get: (id: unknown) => unknown }
        })._fullTextSearches.get(articleSchema.id);

        expect(registration).toBeDefined();
    });

    it('may be declared before or after the change-tracking mode', () => {
        // Both stages carry it, like audit() and softDelete(). Neither order is special.
        class Before extends DataStore {
            articles = this.collection(articleSchema).fullTextSearch().proxy().create();
        }
        class After extends DataStore {
            articles = this.collection(articleSchema).proxy().fullTextSearch().create();
        }

        expect(() => new Before(new MemoryPlugin('fts-before'))).not.toThrow();
        expect(() => new After(new MemoryPlugin('fts-after'))).not.toThrow();
    });

    it('composes with the other stages', () => {
        const withEverything = s.define('fts_composed', {
            id: s.string().key().identity(),
            title: s.string().searchable(),
            deletedAt: s.date().nullable(),
        }).compile();

        class Composed extends DataStore {
            articles = this.collection(withEverything)
                .fullTextSearch({ stopWords: 'english' })
                .softDelete(x => x.deletedAt)
                .proxy()
                .create();
        }

        expect(() => new Composed(new MemoryPlugin('fts-composed'))).not.toThrow();
    });

    describe('the generated index schema', () => {

        const indexSchemaOf = (store: DataStore, name: string) =>
            [...store.schemas].map(([, schema]) => schema).find(schema => schema.collectionName === name);

        it('is registered with the store, so a plugin can build its table', () => {
            // Registered at declaration rather than when maintenance starts: a plugin derives
            // its table from the schema collection, and a schema that arrives late is a table
            // that does not exist on the first save.
            const store = createStore();

            expect(indexSchemaOf(store, 'fts_articles-search-index')).toBeDefined();
        });

        it('has one row per term, field and document', () => {
            const store = createStore();
            const indexSchema = indexSchemaOf(store, 'fts_articles-search-index');
            const names = indexSchema!.properties.map(p => p.name);

            expect(names).toEqual(['_id', 'term', 'field', 'sourceId', 'frequency', 'documentType', '_rev']);
        });

        it('keys on a caller-supplied string, never a computed one', () => {
            // Load-bearing. `View` decides whether it accumulates history or mirrors its source
            // by whether an id property is computed, and a computed key makes it append-only —
            // an index keyed that way keeps terms from deleted documents forever.
            const store = createStore();
            const indexSchema = indexSchemaOf(store, 'fts_articles-search-index');
            const [key] = indexSchema!.idProperties;

            expect(indexSchema!.idProperties).toHaveLength(1);
            // `_id`: PouchDB matches a write's response by it, and MongoDB requires it.
            expect(key.name).toBe('_id');
            expect(key.type).toBe(SchemaTypes.String);
            expect(key.isIdentity).toBe(false);
            expect(key.maxLength).toBe(255);
        });

        it('indexes the term column', () => {
            const store = createStore();
            const indexSchema = indexSchemaOf(store, 'fts_articles-search-index');
            const term = indexSchema!.properties.find(p => p.name === 'term');

            expect(term!.indexes).toContain('term');
        });

        it('copies the source key type onto sourceId', () => {
            const numberKeyed = s.define('fts_numeric', {
                id: s.number().key().identity(),
                title: s.string().searchable(),
            }).compile();

            class NumberStore extends DataStore {
                articles = this.collection(numberKeyed).fullTextSearch().proxy().create();
            }

            const store = new NumberStore(new MemoryPlugin('fts-numeric'));
            const indexSchema = indexSchemaOf(store, 'fts_numeric-search-index');
            const sourceId = indexSchema!.properties.find(p => p.name === 'sourceId');

            expect(sourceId!.type).toBe(SchemaTypes.Number);
        });
    });

    describe('rejects a declaration that cannot work', () => {

        it('throws when no property is searchable', () => {
            // An index over nothing is a declaration error, not an empty index. The likely cause
            // is a forgotten .searchable(), which no runtime symptom would name.
            const unmarked = s.define('fts_unmarked', {
                id: s.string().key().identity(),
                title: s.string(),
            }).compile();

            class Bad extends DataStore {
                articles = this.collection(unmarked).fullTextSearch().proxy().create();
            }

            expect(() => new Bad(new MemoryPlugin('fts-unmarked'))).toThrow(/no searchable properties/);
        });

        it('throws when declared twice', () => {
            class Twice extends DataStore {
                articles = this.collection(articleSchema)
                    .fullTextSearch()
                    .fullTextSearch()
                    .proxy()
                    .create();
            }

            expect(() => new Twice(new MemoryPlugin('fts-twice'))).toThrow(/declared more than once/);
        });

        it('throws when a tokenizer is combined with a pipeline option', () => {
            // A tokenizer replaces the pipeline, so these would be silently ignored.
            class Conflicting extends DataStore {
                articles = this.collection(articleSchema)
                    .fullTextSearch({ tokenizer: text => text.split(' '), stopWords: 'english' })
                    .proxy()
                    .create();
            }

            expect(() => new Conflicting(new MemoryPlugin('fts-conflict'))).toThrow(/replaces the whole built-in pipeline/);
        });

        it('allows a tokenizer on its own', () => {
            class Custom extends DataStore {
                articles = this.collection(articleSchema)
                    .fullTextSearch({ tokenizer: text => text.split(' ') })
                    .proxy()
                    .create();
            }

            expect(() => new Custom(new MemoryPlugin('fts-custom'))).not.toThrow();
        });

        it('throws on a composite key', () => {
            const composite = s.define('fts_composite', {
                tenant: s.string().key(),
                id: s.string().key(),
                title: s.string().searchable(),
            }).compile();

            class Bad extends DataStore {
                articles = this.collection(composite).fullTextSearch().proxy().create();
            }

            expect(() => new Bad(new MemoryPlugin('fts-composite'))).toThrow(/requires a single key property/);
        });

        it('throws on a computed key', () => {
            // A key derived from the entity changes when the entity does, so every index row
            // for the old key is stranded by an ordinary edit. There is no check that a key is
            // a string or a number, because the schema builder already only offers `key()` on
            // those two — computed is the one wrong key that compiles.
            const computedKey = s.define('fts_computed_key', {
                title: s.string().searchable(),
            }).modify(x => ({
                slug: x.computed(entity => entity.title.toLowerCase()).tracked().key(),
            })).compile();

            class Bad extends DataStore {
                articles = this.collection(computedKey).fullTextSearch().proxy().create();
            }

            expect(() => new Bad(new MemoryPlugin('fts-computed'))).toThrow(/computed/);
        });
    });

    it('costs nothing when properties are searchable but nothing is declared', () => {
        // The two halves are independent on purpose: marking a property is free.
        class NoIndex extends DataStore {
            articles = this.collection(articleSchema).proxy().create();
        }

        const store = new NoIndex(new MemoryPlugin('fts-none'));
        const names = [...store.schemas].map(([, schema]) => schema.collectionName);

        expect(names).not.toContain('fts_articles-search-index');
    });
});
