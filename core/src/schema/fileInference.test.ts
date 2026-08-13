import { describe, expect, it } from '@jest/globals';
import { s } from './index';
import type { FileContentValue, FileReferenceValue, InferCreateType, InferType } from './types';

/**
 * Every assertion below is a type assertion, checked by the compiler and never executed.
 *
 * The bodies dereference values that do not exist at runtime, so they are wrapped in a
 * function that is declared and not called. `typeChecks` exists to make that explicit and to
 * give Jest something to assert about, since the real verdict was delivered by `tsc` before
 * the test ever ran: a regression here fails to compile.
 */
const typeChecks = (check: (...args: never[]) => unknown) => expect(typeof check).toBe('function');

/** A value that exists only for the type checker. */
const typed = <T>() => undefined as unknown as T;

/**
 * The types a file property produces, in both directions.
 *
 * A file is the one property whose write shape differs from its read shape: content goes in,
 * a reference comes out. Both halves are inferred, and neither is checked by any runtime
 * assertion — a mistake here compiles into an application and shows up as a wrong type at a
 * call site, so the assertions in this file are plain typed assignments. A regression fails
 * to COMPILE.
 *
 * The modifier cases are the ones worth having. `s.file().optional()` is a `SchemaOptional`
 * and `s.file().tag('x')` is a `SchemaTag`; neither carries `SchemaFile` in its type, so an
 * inference rule written against the class alone passes the bare case and silently breaks
 * every decorated one.
 */

const schema = s.define('documents', {
    id: s.string().key().identity(),
    title: s.string(),
    file: s.file(),
}).compile();

type Entity = InferType<typeof schema>;
type Draft = InferCreateType<typeof schema>;

describe('a file property', () => {

    describe('reading', () => {

        it('gives back a reference, field by field', () => {
            typeChecks((entity: Entity) => {
                const key: string = entity.file.key;
                const size: number = entity.file.size;
                const contentType: string = entity.file.contentType;
                const checksum: string = entity.file.checksum;
                const fileName: string = entity.file.fileName;

                return [key, size, contentType, checksum, fileName];
            });
        });

        it('is assignable to the reference shape as a whole', () => {
            typeChecks((entity: Entity) => {
                const reference: FileReferenceValue = entity.file;

                return reference;
            });
        });
    });

    describe('writing', () => {

        it('accepts a Uint8Array', () => {
            const draft: Draft = { title: 'x', file: new Uint8Array([1, 2, 3]) };

            void draft;
            expect(true).toBe(true);
        });

        it('accepts a Blob, which is what an <input type="file"> yields', () => {
            const draft: Draft = { title: 'x', file: new Blob(['hi'], { type: 'text/plain' }) };

            void draft;
            expect(true).toBe(true);
        });

        it('accepts a string and an ArrayBuffer', () => {
            const fromString: Draft = { title: 'x', file: 'plain text' };
            const fromBuffer: Draft = { title: 'x', file: new ArrayBuffer(8) };

            void [fromString, fromBuffer];
            expect(true).toBe(true);
        });

        it('accepts a reference, so a round-tripped entity can be saved again', () => {
            typeChecks((entity: Entity) => {
                const draft: Draft = { title: 'x', file: entity.file };

                return draft;
            });
        });

        it('is exactly the content union', () => {
            typeChecks((content: FileContentValue) => {
                const draft: Draft = { title: 'x', file: content };

                return draft;
            });
        });
    });

    describe('through modifiers', () => {

        it('keeps both shapes when optional', () => {
            const optional = s.define('a', {
                id: s.string().key().identity(),
                file: s.file().optional(),
            }).compile();

            typeChecks((entity: InferType<typeof optional>) => {
                // Read: still a reference, now possibly absent.
                const size: number | undefined = entity.file?.size;

                // Write: still accepts content.
                const draft: InferCreateType<typeof optional> = { file: new Uint8Array([1]) };

                return [size, draft];
            });
        });

        it('keeps both shapes when nullable', () => {
            const nullable = s.define('b', {
                id: s.string().key().identity(),
                file: s.file().nullable(),
            }).compile();

            typeChecks((entity: InferType<typeof nullable>) => {
                const key: string | null = entity.file == null ? null : entity.file.key;
                const draft: InferCreateType<typeof nullable> = { file: new Uint8Array([1]) };

                return [key, draft];
            });
        });

        it('keeps both shapes when tagged', () => {
            const tagged = s.define('c', {
                id: s.string().key().identity(),
                file: s.file().tag('avatar'),
            }).compile();

            typeChecks((entity: InferType<typeof tagged>) => {
                const contentType: string = entity.file.contentType;
                const draft: InferCreateType<typeof tagged> = { file: 'text' };

                return [contentType, draft];
            });
        });
    });

    describe('alongside other properties', () => {

        it('does not disturb their inference', () => {
            const mixed = s.define('d', {
                id: s.string().key().identity(),
                count: s.number(),
                flag: s.boolean(),
                when: s.date(),
                tags: s.array(s.string()),
                nested: s.object({ inner: s.string() }),
                file: s.file(),
            }).compile();

            typeChecks((entity: InferType<typeof mixed>) => {
                const count: number = entity.count;
                const flag: boolean = entity.flag;
                const when: Date = entity.when;
                const tags: string[] = entity.tags;
                const inner: string = entity.nested.inner;
                const key: string = entity.file.key;

                return [count, flag, when, tags, inner, key];
            });
        });

        it('lets two files coexist', () => {
            const media = s.define('e', {
                id: s.string().key().identity(),
                original: s.file(),
                thumbnail: s.file(),
            }).compile();

            typeChecks((entity: InferType<typeof media>) => {
                const originalSize: number = entity.original.size;
                const thumbnailSize: number = entity.thumbnail.size;

                const draft: InferCreateType<typeof media> = {
                    original: new Uint8Array([1]),
                    thumbnail: new Uint8Array([2]),
                };

                return [originalSize, thumbnailSize, draft];
            });
        });
    });

    describe('the compiled schema', () => {

        it('reports the property as a file and gives it no children', () => {
            const property = schema.properties.find(p => p.name === 'file');

            expect(property?.type).toBe('File');

            // A leaf on purpose. Children are what make the generated preprocess rebuild an
            // object field by field, which is exactly what discards content.
            expect(schema.properties.filter(p => p.parent?.name === 'file')).toEqual([]);
        });
    });
});
