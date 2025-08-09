import { describe, it, expect, vi } from 'vitest';
import { CollectionChanges, CollectionChangesResult, PendingChanges, ResolvedChanges } from './Changes';
import { TagCollection } from './TagCollection';

describe('CollectionChanges', () => {
    describe('constructor', () => {
        it('should create empty collection changes when no parameters provided', () => {
            const changes = new CollectionChanges();

            expect(changes.adds.entities).toEqual([]);
            expect(changes.updates.changes).toEqual([]);
            expect(changes.removes.entities).toEqual([]);
            expect(changes.tags).toBeInstanceOf(TagCollection);
        });

        it('should create collection changes with provided data', () => {
            const adds = { entities: [{ id: '1', name: 'test' }] };
            const updates = { changes: [{ entity: { id: '2', name: 'updated' }, changes: {} }] };
            const removes = { entities: [{ id: '3', name: 'removed' }] };

            const changes = new CollectionChanges({ adds, updates, removes } as any);

            expect(changes.adds.entities).toEqual(adds.entities);
            expect(changes.updates.changes).toEqual(updates.changes);
            expect(changes.removes.entities).toEqual(removes.entities);
        });

        it('should create collection changes with partial data', () => {
            const adds = { entities: [{ id: '1', name: 'test' }] };

            const changes = new CollectionChanges({ adds } as any);

            expect(changes.adds.entities).toEqual(adds.entities);
            expect(changes.updates.changes).toEqual([]);
            expect(changes.removes.entities).toEqual([]);
        });
    });

    describe('EMPTY', () => {
        it('should create empty collection changes', () => {
            const changes = CollectionChanges.EMPTY();

            expect(changes.adds.entities).toEqual([]);
            expect(changes.updates.changes).toEqual([]);
            expect(changes.removes.entities).toEqual([]);
            expect(changes.hasChanges).toBe(false);
        });
    });

    describe('hasChanges', () => {
        it('should return false when no changes exist', () => {
            const changes = new CollectionChanges();

            expect(changes.hasChanges).toBe(false);
        });

        it('should return true when adds exist', () => {
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] }
            } as any);

            expect(changes.hasChanges).toBe(true);
        });

        it('should return true when updates exist', () => {
            const changes = new CollectionChanges({
                updates: { changes: [{ entity: { id: '1' }, changes: {} }] }
            } as any);

            expect(changes.hasChanges).toBe(true);
        });

        it('should return true when removes exist', () => {
            const changes = new CollectionChanges({
                removes: { entities: [{ id: '1', name: 'test' }] }
            } as any);

            expect(changes.hasChanges).toBe(true);
        });

        it('should return true when multiple change types exist', () => {
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] },
                updates: { changes: [{ entity: { id: '2' }, changes: {} }] },
                removes: { entities: [{ id: '3', name: 'removed' }] }
            } as any);

            expect(changes.hasChanges).toBe(true);
        });
    });

    describe('combine', () => {
        it('should combine two collection changes', () => {
            const changes1 = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test1' }] },
                updates: { changes: [{ entity: { id: '2' }, changes: {} }] }
            } as any);

            const changes2 = new CollectionChanges({
                adds: { entities: [{ id: '3', name: 'test2' }] },
                removes: { entities: [{ id: '4', name: 'removed' }] }
            } as any);

            changes1.combine(changes2);

            expect(changes1.adds.entities).toHaveLength(2);
            expect(changes1.updates.changes).toHaveLength(1);
            expect(changes1.removes.entities).toHaveLength(1);
        });

        it('should combine empty collection changes', () => {
            const changes1 = new CollectionChanges();
            const changes2 = new CollectionChanges();

            changes1.combine(changes2);

            expect(changes1.adds.entities).toEqual([]);
            expect(changes1.updates.changes).toEqual([]);
            expect(changes1.removes.entities).toEqual([]);
        });
    });
});

describe('CollectionChangesResult', () => {
    describe('constructor', () => {
        it('should create empty result when no parameters provided', () => {
            const result = new CollectionChangesResult();

            expect(result.adds.entities).toEqual([]);
            expect(result.updates.entities).toEqual([]);
            expect(result.removes.entities).toEqual([]);
        });
    });

    describe('EMPTY', () => {
        it('should create empty result', () => {
            const result = CollectionChangesResult.EMPTY();

            expect(result.adds.entities).toEqual([]);
            expect(result.updates.entities).toEqual([]);
            expect(result.removes.entities).toEqual([]);
            expect(result.hasChanges).toBe(false);
        });
    });

    describe('hasChanges', () => {
        it('should return false when no changes exist', () => {
            const result = new CollectionChangesResult();

            expect(result.hasChanges).toBe(false);
        });

        it('should return true when adds exist', () => {
            const result = new CollectionChangesResult();
            result.adds.entities.push({ id: '1', name: 'test' } as any);

            expect(result.hasChanges).toBe(true);
        });

        it('should return true when updates exist', () => {
            const result = new CollectionChangesResult();
            result.updates.entities.push({ id: '1', name: 'updated' } as any);

            expect(result.hasChanges).toBe(true);
        });

        it('should return true when removes exist', () => {
            const result = new CollectionChangesResult();
            result.removes.entities.push({ id: '1', name: 'removed' } as any);

            expect(result.hasChanges).toBe(true);
        });
    });

    describe('combine', () => {
        it('should combine two results', () => {
            const result1 = new CollectionChangesResult();
            result1.adds.entities.push({ id: '1', name: 'test1' } as any);
            result1.updates.entities.push({ id: '2', name: 'updated' } as any);

            const result2 = new CollectionChangesResult();
            result2.adds.entities.push({ id: '3', name: 'test2' } as any);
            result2.removes.entities.push({ id: '4', name: 'removed' } as any);

            result1.combine(result2);

            expect(result1.adds.entities).toHaveLength(2);
            expect(result1.updates.entities).toHaveLength(1);
            expect(result1.removes.entities).toHaveLength(1);
        });

        it('should combine empty results', () => {
            const result1 = new CollectionChangesResult();
            const result2 = new CollectionChangesResult();

            result1.combine(result2);

            expect(result1.adds.entities).toEqual([]);
            expect(result1.updates.entities).toEqual([]);
            expect(result1.removes.entities).toEqual([]);
        });
    });
});

describe('PendingChanges', () => {
    describe('constructor', () => {
        it('should create empty pending changes when no data provided', () => {
            const pendingChanges = new PendingChanges();

            expect(pendingChanges.changes).toBeDefined();
            expect(pendingChanges.changes.count()).toBe(0);
        });

        it('should create pending changes with provided data', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] }
            } as any);
            data.set('schema1', { changes });

            const pendingChanges = new PendingChanges(data);

            expect(pendingChanges.changes.count()).toBe(1);
        });
    });

    describe('toResult', () => {
        it('should convert pending changes to resolved changes', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] }
            } as any);
            data.set('schema1', { changes });

            const pendingChanges = new PendingChanges(data);
            const resolvedChanges = pendingChanges.toResult();

            expect(resolvedChanges).toBeInstanceOf(ResolvedChanges);
            expect(resolvedChanges.result.count()).toBe(0);
            expect(resolvedChanges.changes.count()).toBe(1);
        });

        it('should handle empty pending changes', () => {
            const pendingChanges = new PendingChanges();
            const resolvedChanges = pendingChanges.toResult();

            expect(resolvedChanges).toBeInstanceOf(ResolvedChanges);
            expect(resolvedChanges.result.count()).toBe(0);
        });
    });
});

describe('ResolvedChanges', () => {
    describe('constructor', () => {
        it('should create resolved changes with result set', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] }
            } as any);
            const result = CollectionChangesResult.EMPTY();
            result.adds.entities.push({ id: '1', name: 'test' } as any);
            data.set('schema1', { changes, result });

            const resolvedChanges = new ResolvedChanges(data);

            expect(resolvedChanges.result).toBeDefined();
            expect(resolvedChanges.result.count()).toBe(1);
        });
    });
});

describe('ChangeSet', () => {
    describe('count', () => {
        it('should return total count of all changes', () => {
            const data = new Map();
            const changes1 = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test1' }] },
                updates: { changes: [{ entity: { id: '2' }, changes: {} }] }
            } as any);
            const changes2 = new CollectionChanges({
                removes: { entities: [{ id: '3', name: 'removed' }] }
            } as any);

            data.set('schema1', { changes: changes1 });
            data.set('schema2', { changes: changes2 });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            expect(changeSet.changes.count()).toBe(3);
        });

        it('should return zero for empty change set', () => {
            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super();
                }
            })();

            expect(changeSet.changes.count()).toBe(0);
        });
    });

    describe('set and get', () => {
        it('should set and get changes for schema', () => {
            const data = new Map();
            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] }
            } as any);

            changeSet.changes.set('schema1', changes);
            const retrieved = changeSet.changes.get('schema1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.adds.entities).toEqual(changes.adds.entities);
        });

        it('should return undefined for non-existent schema', () => {
            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super();
                }
            })();

            const retrieved = changeSet.changes.get('non-existent');

            expect(retrieved).toBeUndefined();
        });
    });

    describe('adds', () => {
        it('should return all adds when no schema specified', () => {
            const data = new Map();
            const changes1 = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test1' }] }
            } as any);
            const changes2 = new CollectionChanges({
                adds: { entities: [{ id: '2', name: 'test2' }] }
            } as any);

            data.set('schema1', { changes: changes1 });
            data.set('schema2', { changes: changes2 });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.adds();

            expect(result.data).toHaveLength(2);
            expect(result.count()).toBe(2);
        });

        it('should return adds for specific schema', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] }
            } as any);

            data.set('schema1', { changes });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.adds('schema1');

            expect(result.data).toHaveLength(1);
            expect(result.count()).toBe(1);
        });

        it('should return empty array for non-existent schema', () => {
            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super();
                }
            })();

            const result = changeSet.changes.adds('non-existent');

            expect(result.data).toEqual([]);
            expect(result.count()).toBe(0);
        });
    });

    describe('removes', () => {
        it('should return all removes when no schema specified', () => {
            const data = new Map();
            const changes1 = new CollectionChanges({
                removes: { entities: [{ id: '1', name: 'removed1' }] }
            } as any);
            const changes2 = new CollectionChanges({
                removes: { entities: [{ id: '2', name: 'removed2' }] }
            } as any);

            data.set('schema1', { changes: changes1 });
            data.set('schema2', { changes: changes2 });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.removes();

            expect(result.data).toHaveLength(2);
            expect(result.count()).toBe(2);
        });

        it('should return removes for specific schema', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                removes: { entities: [{ id: '1', name: 'removed' }] }
            } as any);

            data.set('schema1', { changes });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.removes('schema1');

            expect(result.data).toHaveLength(1);
            expect(result.count()).toBe(1);
        });
    });

    describe('updates', () => {
        it('should return all updates when no schema specified', () => {
            const data = new Map();
            const changes1 = new CollectionChanges({
                updates: { changes: [{ entity: { id: '1' }, changes: {} }] }
            } as any);
            const changes2 = new CollectionChanges({
                updates: { changes: [{ entity: { id: '2' }, changes: {} }] }
            } as any);

            data.set('schema1', { changes: changes1 });
            data.set('schema2', { changes: changes2 });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.updates();

            expect(result.data).toHaveLength(2);
            expect(result.count()).toBe(2);
        });

        it('should return updates for specific schema', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                updates: { changes: [{ entity: { id: '1' }, changes: {} }] }
            } as any);

            data.set('schema1', { changes });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.updates('schema1');

            expect(result.data).toHaveLength(1);
            expect(result.count()).toBe(1);
        });
    });

    describe('all', () => {
        it('should return all changes when no schema specified', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] },
                updates: { changes: [{ entity: { id: '2' }, changes: {} }] },
                removes: { entities: [{ id: '3', name: 'removed' }] }
            } as any);

            data.set('schema1', { changes });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.all();

            expect(result.data).toHaveLength(3);
            expect(result.count()).toBe(3);
        });

        it('should return all changes for specific schema', () => {
            const data = new Map();
            const changes = new CollectionChanges({
                adds: { entities: [{ id: '1', name: 'test' }] },
                updates: { changes: [{ entity: { id: '2' }, changes: {} }] },
                removes: { entities: [{ id: '3', name: 'removed' }] }
            } as any);

            data.set('schema1', { changes });

            const changeSet = new (class extends (PendingChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = changeSet.changes.all('schema1');

            expect(result.data).toHaveLength(3);
            expect(result.count()).toBe(3);
        });
    });
});

describe('ResultSet', () => {
    describe('count', () => {
        it('should return total count of all results', () => {
            const data = new Map();
            const result1 = CollectionChangesResult.EMPTY();
            result1.adds.entities.push({ id: '1', name: 'test1' } as any);
            result1.updates.entities.push({ id: '2', name: 'updated' } as any);

            const result2 = CollectionChangesResult.EMPTY();
            result2.removes.entities.push({ id: '3', name: 'removed' } as any);

            data.set('schema1', { changes: new CollectionChanges(), result: result1 });
            data.set('schema2', { changes: new CollectionChanges(), result: result2 });

            const resultSet = new (class extends (ResolvedChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            expect(resultSet.result.count()).toBe(3);
        });
    });

    describe('set and get', () => {
        it('should set and get result for schema', () => {
            const data = new Map();
            const changes = new CollectionChanges();
            const result = CollectionChangesResult.EMPTY();
            result.adds.entities.push({ id: '1', name: 'test' } as any);

            data.set('schema1', { changes, result });

            const resultSet = new (class extends (ResolvedChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const newResult = CollectionChangesResult.EMPTY();
            newResult.adds.entities.push({ id: '2', name: 'test2' } as any);

            resultSet.result.set('schema1', newResult);
            const retrieved = resultSet.result.get('schema1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.adds.entities).toEqual(newResult.adds.entities);
        });
    });

    describe('adds', () => {
        it('should return all adds when no schema specified', () => {
            const data = new Map();
            const result1 = CollectionChangesResult.EMPTY();
            result1.adds.entities.push({ id: '1', name: 'test1' } as any);

            const result2 = CollectionChangesResult.EMPTY();
            result2.adds.entities.push({ id: '2', name: 'test2' } as any);

            data.set('schema1', { changes: new CollectionChanges(), result: result1 });
            data.set('schema2', { changes: new CollectionChanges(), result: result2 });

            const resultSet = new (class extends (ResolvedChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = resultSet.result.adds();

            expect(result.data).toHaveLength(2);
            expect(result.count()).toBe(2);
        });

        it('should return adds for specific schema', () => {
            const data = new Map();
            const result = CollectionChangesResult.EMPTY();
            result.adds.entities.push({ id: '1', name: 'test' } as any);

            data.set('schema1', { changes: new CollectionChanges(), result });

            const resultSet = new (class extends (ResolvedChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const addsResult = resultSet.result.adds('schema1');

            expect(addsResult.data).toHaveLength(1);
            expect(addsResult.count()).toBe(1);
        });
    });

    describe('removes', () => {
        it('should return all removes when no schema specified', () => {
            const data = new Map();
            const result1 = CollectionChangesResult.EMPTY();
            result1.removes.entities.push({ id: '1', name: 'removed1' } as any);

            const result2 = CollectionChangesResult.EMPTY();
            result2.removes.entities.push({ id: '2', name: 'removed2' } as any);

            data.set('schema1', { changes: new CollectionChanges(), result: result1 });
            data.set('schema2', { changes: new CollectionChanges(), result: result2 });

            const resultSet = new (class extends (ResolvedChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = resultSet.result.removes();

            expect(result.data).toHaveLength(2);
            expect(result.count()).toBe(2);
        });
    });

    describe('updates', () => {
        it('should return all updates when no schema specified', () => {
            const data = new Map();
            const result1 = CollectionChangesResult.EMPTY();
            result1.updates.entities.push({ id: '1', name: 'updated1' } as any);

            const result2 = CollectionChangesResult.EMPTY();
            result2.updates.entities.push({ id: '2', name: 'updated2' } as any);

            data.set('schema1', { changes: new CollectionChanges(), result: result1 });
            data.set('schema2', { changes: new CollectionChanges(), result: result2 });

            const resultSet = new (class extends (ResolvedChanges as any) {
                constructor() {
                    super(data);
                }
            })();

            const result = resultSet.result.updates();

            expect(result.data).toHaveLength(2);
            expect(result.count()).toBe(2);
        });
    });
});
