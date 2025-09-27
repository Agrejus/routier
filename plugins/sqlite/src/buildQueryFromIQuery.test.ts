import { describe, it, expect, vi } from 'vitest';
import { buildFromQueryOperation } from './utils';
import { DbPluginQueryEvent } from '@routier/core/plugins';
import { s } from '@routier/core/schema';
import { SqliteDbPlugin } from './SqliteDbPlugin';
import { PluginEventCallbackResult } from '@routier/core/results';
import { DataStore } from '@routier/datastore';

const userSchema = s.define('users', {
    id: s.number().key().identity(),
    name: s.string(),
    age: s.number()
});

const compiledUserSchema = userSchema.compile();

class SqliteTestPlugin extends SqliteDbPlugin {
    private onQuery: (event: DbPluginQueryEvent<any, any>) => void;

    constructor(onQuery: (event: DbPluginQueryEvent<any, any>) => void) {
        super(":memory:");
        this.onQuery = onQuery;
    }

    override query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<TShape>): void {
        this.onQuery(event);
        // Don't call done() - we only care about capturing the query structure
    }
}

class TestDataStore extends DataStore {
    users = this.collection(compiledUserSchema).create();
}

describe('buildQueryFromIQuery Integration Tests', () => {

    it('should build a simple SELECT query with no options', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a query with no filters
        datastore.users.firstOrUndefined(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" LIMIT 1');
        expect(result.params).toEqual([]);
    });

    it('should build a query with a filter from natural JavaScript', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a query with a filter
        datastore.users.firstOrUndefined(x => x.age === 25, vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "age" = ? LIMIT 1');
        expect(result.params).toEqual([25]);
    });

    it('should build a query with multiple operations in order', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a query with filter, sort, and take
        datastore.users
            .where(x => x.age > 18)
            .sort(x => x.name)
            .take(10)
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "age" > ? ORDER BY "name" ASC LIMIT 10');
        expect(result.params).toEqual([18]);
    });

    it('should build a query with skip requiring a subquery', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a query with sort and skip
        datastore.users
            .sortDescending(x => x.name)
            .skip(5)
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM (SELECT "id", "name", "age" FROM "users" ORDER BY "name" DESC) AS subquery_1 OFFSET 5');
        expect(result.params).toEqual([]);
    });

    it('should build a COUNT query', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a count query
        datastore.users.count(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT COUNT(*) FROM "users"');
        expect(result.params).toEqual([]);
    });

    it('should build a query with multiple filters combined with AND', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a query with multiple filters
        datastore.users
            .where(x => x.age > 18)
            .where(x => x.name.startsWith('John'))
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "age" > ? AND "name" LIKE ?');
        expect(result.params).toEqual([18, 'John%']);
    });

    it('should build a query with DISTINCT', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a distinct query
        datastore.users.distinct(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT DISTINCT "id", "name", "age" FROM "users"');
        expect(result.params).toEqual([]);
    });

    it('should build a complex query with skip, take, and sort', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a complex query with multiple operations
        datastore.users
            .sortDescending(x => x.age)
            .skip(10)
            .take(5)
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM (SELECT "id", "name", "age" FROM (SELECT "id", "name", "age" FROM "users" ORDER BY "age" DESC) AS subquery_1 OFFSET 10) AS subquery_2 LIMIT 5');
        expect(result.params).toEqual([]);
    });

    it('should build a query with multiple filters (double filter scenario)', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a query with multiple filters using chained where calls
        datastore.users
            .where(x => x.age > 18)
            .where(x => x.name.startsWith('John'))
            .where(x => x.age < 65)
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "age" > ? AND "name" LIKE ? AND "age" < ?');
        expect(result.params).toEqual([18, 'John%', 65]);
    });

    it('should build a query with MIN aggregate function', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a MIN query
        datastore.users.min(x => x.age, vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT MIN("age") FROM "users"');
        expect(result.params).toEqual([]);
    });

    it('should build a query with MAX aggregate function', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a MAX query
        datastore.users.max(x => x.age, vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT MAX("age") FROM "users"');
        expect(result.params).toEqual([]);
    });

    it('should build a query with SUM aggregate function', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a SUM query
        datastore.users.sum(x => x.age, vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT SUM("age") FROM "users"');
        expect(result.params).toEqual([]);
    });

    it('should build a query with filter and MIN aggregate', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a filtered MIN query
        datastore.users
            .where(x => x.age > 18)
            .min(x => x.age, vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT MIN("age") FROM "users" WHERE "age" > ?');
        expect(result.params).toEqual([18]);
    });

    it('should build a query with map operation', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a map query
        datastore.users
            .map(x => ({ name: x.name, age: x.age }))
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        // Map operations are handled in memory, so we expect the base query
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users"');
        expect(result.params).toEqual([]);
    });

    it('should build a query with some operation', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a some query
        datastore.users.some(x => x.age > 18, vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "age" > ? LIMIT 1');
        expect(result.params).toEqual([18]);
    });

    it('should build a query with every operation', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger an every query
        datastore.users.every(x => x.age > 18, vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users"');
        expect(result.params).toEqual([]);
    });

    it('should build a query with first operation', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a first query
        datastore.users.first(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" LIMIT 1');
        expect(result.params).toEqual([]);
    });

    it('should build a query with first and filter', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a filtered first query
        datastore.users
            .where(x => x.age > 18)
            .first(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "age" > ? LIMIT 1');
        expect(result.params).toEqual([18]);
    });

    it('should build a query with complex combination: filter, sort, skip, take', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a complex query with all major operations
        datastore.users
            .where(x => x.age > 18)
            .sort(x => x.name)
            .skip(5)
            .take(10)
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM (SELECT "id", "name", "age" FROM (SELECT "id", "name", "age" FROM "users" WHERE "age" > ? ORDER BY "name" ASC) AS subquery_1 OFFSET 5) AS subquery_2 LIMIT 10');
        expect(result.params).toEqual([18]);
    });

    it('should handle query with two filters', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // This will trigger a complex query with all major operations
        datastore.users
            .where(x => x.age > 18)
            .sort(x => x.name)
            .skip(5)
            .take(10)
            .where(x => x.name != null)
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM (SELECT "id", "name", "age" FROM (SELECT "id", "name", "age" FROM "users" WHERE "age" > ? AND "name" IS NOT NULL ORDER BY "name" ASC) AS subquery_1 OFFSET 5) AS subquery_2 LIMIT 10');
        expect(result.params).toEqual([18]);
    });

    it('should handle null comparisons correctly', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // Test IS NOT NULL
        datastore.users.where(x => x.name != null).toArray(vi.fn<any>());
        expect(capturedQuery).toBeDefined();
        let result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "name" IS NOT NULL');
        expect(result.params).toEqual([]);

        // Test IS NULL
        datastore.users.where(x => x.name == null).toArray(vi.fn<any>());
        expect(capturedQuery).toBeDefined();
        result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "name" IS NULL');
        expect(result.params).toEqual([]);
    });

    it('should handle parameter order correctly with mixed null and non-null comparisons', () => {
        let capturedQuery: any = null;

        const plugin = new SqliteTestPlugin((event) => {
            capturedQuery = event.operation;
        });

        const datastore = new TestDataStore(plugin);

        // Test mixed: non-null comparison + null comparison
        datastore.users
            .where(x => x.age > 18)
            .where(x => x.name != null)
            .toArray(vi.fn<any>());

        expect(capturedQuery).toBeDefined();
        const result = buildFromQueryOperation(capturedQuery);
        expect(result.sql).toBe('SELECT "id", "name", "age" FROM "users" WHERE "age" > ? AND "name" IS NOT NULL');
        expect(result.params).toEqual([18]); // Only the non-null comparison adds a parameter
    });
});
