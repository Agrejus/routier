import { describe, expect, it } from '@jest/globals';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from '@routier/core/collections';
import { DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { etags, InferRoot, s } from '@routier/core/schema';
import { carriesEtags, withoutEtags, withSourceEtags } from './mirrorEtags';

const versioned = s.define('mirror_versioned', {
    id: s.string().key(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();

const plain = s.define('mirror_plain', {
    id: s.string().key(),
    name: s.string(),
}).compile();

const schemas = new SchemaCollection().set(versioned.id, versioned).set(plain.id, plain);

const eventOf = (operation: BulkPersistChanges, eventSchemas = schemas): DbPluginBulkPersistEvent => ({
    id: 'event',
    schemas: eventSchemas,
    operation,
    source: 'test',
    action: 'persist',
});

const versionedUpdates = (...rows: { id: string, name: string, version: number }[]) => {
    const operation = new BulkPersistChanges();
    operation.resolve<InferRoot<typeof versioned>>(versioned.id).updates.push(...rows.map(entity => ({ entity, changeType: 'markedDirty' as const, delta: {} })));
    return operation;
};

const plainUpdates = () => {
    const operation = new BulkPersistChanges();
    operation.resolve<InferRoot<typeof plain>>(plain.id).updates.push({ entity: { id: 'p', name: 'plain' }, changeType: 'markedDirty', delta: {} });
    return operation;
};

const sourceResult = (...rows: { id: string, name: string, version: number }[]) => {
    const result = new BulkPersistResult();
    result.resolve<InferRoot<typeof versioned>>(versioned.id).updates.push(...rows);
    return result;
};

describe('carriesEtags', () => {
    it('is true when a schema with an etag has changes', () => {
        expect(carriesEtags(eventOf(versionedUpdates({ id: 'a', name: 'A', version: 1 })))).toBe(true);
    });

    it('is true when only one of several schemas has an etag', () => {
        const operation = plainUpdates();
        operation.set(versioned.id, versionedUpdates({ id: 'a', name: 'A', version: 1 }).get(versioned.id));

        expect(carriesEtags(eventOf(operation))).toBe(true);
    });

    it('is false when the schema with an etag has no changes', () => {
        const operation = new BulkPersistChanges();
        operation.resolve(versioned.id);

        expect(carriesEtags(eventOf(operation))).toBe(false);
    });

    it('is false when no schema has an etag', () => {
        expect(carriesEtags(eventOf(plainUpdates()))).toBe(false);
    });

    it('is false for changes whose schema the event does not carry', () => {
        expect(carriesEtags(eventOf(versionedUpdates({ id: 'a', name: 'A', version: 1 }), new SchemaCollection()))).toBe(false);
    });
});

describe('withSourceEtags', () => {
    it('gives each update the etag the source generated for that row', () => {
        const stamped = withSourceEtags(versionedUpdates({ id: 'a', name: 'A', version: 1 }, { id: 'b', name: 'B', version: 4 }), sourceResult({ id: 'b', name: 'B', version: 5 }, { id: 'a', name: 'A', version: 2 }), schemas);

        expect(stamped.get(versioned.id)?.updates.map(update => update.entity)).toEqual([{ id: 'a', name: 'A', version: 2 }, { id: 'b', name: 'B', version: 5 }]);
    });

    it('leaves an update the source did not report unchanged', () => {
        const operation = versionedUpdates({ id: 'a', name: 'A', version: 1 });

        const stamped = withSourceEtags(operation, sourceResult({ id: 'z', name: 'Z', version: 9 }), schemas);

        expect(stamped.get(versioned.id)?.updates[0]).toBe(operation.get(versioned.id)?.updates[0]);
    });

    it('leaves the updates unchanged when the source reported nothing for the schema', () => {
        const operation = versionedUpdates({ id: 'a', name: 'A', version: 1 });

        const stamped = withSourceEtags(operation, new BulkPersistResult(), schemas);

        expect(stamped.get(versioned.id)?.updates).toEqual(operation.get(versioned.id)?.updates);
    });

    it('keeps the adds, removes and tags of a schema with an etag', () => {
        const operation = versionedUpdates({ id: 'a', name: 'A', version: 1 });
        const changes = operation.get<InferRoot<typeof versioned>>(versioned.id);
        changes.adds.push({ id: 'n', name: 'new' });
        changes.removes.push({ id: 'r', name: 'gone', version: 3 });

        const stamped = withSourceEtags(operation, sourceResult(), schemas).get(versioned.id);

        expect([stamped?.adds, stamped?.removes, stamped?.tags]).toEqual([changes.adds, changes.removes, changes.tags]);
    });

    it('passes through the changes of a schema without an etag', () => {
        const operation = plainUpdates();

        expect(withSourceEtags(operation, sourceResult(), schemas).get(plain.id)).toBe(operation.get(plain.id));
    });

    it('passes through changes whose schema it does not know', () => {
        const operation = versionedUpdates({ id: 'a', name: 'A', version: 1 });

        expect(withSourceEtags(operation, sourceResult({ id: 'a', name: 'A', version: 2 }), new SchemaCollection()).get(versioned.id)).toBe(operation.get(versioned.id));
    });
});

describe('withoutEtags', () => {
    it('passes through changes whose schema it does not know', () => {
        const operation = versionedUpdates({ id: 'a', name: 'A', version: 1 });

        expect(withoutEtags(operation, new SchemaCollection()).get(versioned.id)).toBe(operation.get(versioned.id));
    });
});
