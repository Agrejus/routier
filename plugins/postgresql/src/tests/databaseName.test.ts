import { describe, it, expect } from '@jest/globals';
import { PostgresDbPlugin } from '../PostgresDbPlugin';

/**
 * `IDbPlugin.databaseName` scopes subscription channels, so getting it wrong is not cosmetic:
 * two instances that disagree stop seeing each other's changes, and two that agree when they
 * should not cross-talk between unrelated databases.
 *
 * Constructing the plugin builds a `Pool`, which does not connect until a query runs — so these
 * assert the derivation without a server.
 */
describe('PostgresDbPlugin.databaseName', () => {

    it('includes host and port, because one database name lives on many servers', () => {
        const here = new PostgresDbPlugin({ host: 'a.example.com', port: 5432, database: 'app' });
        const there = new PostgresDbPlugin({ host: 'b.example.com', port: 5432, database: 'app' });

        expect(here.databaseName).not.toBe(there.databaseName);
        expect(here.databaseName).toContain('a.example.com');
        expect(here.databaseName).toContain('app');
    });

    it('is the same for two instances built from equal config', () => {
        const config = { host: 'db.example.com', port: 5432, database: 'app' };

        // The two-process case: separate instances of one database must land on one channel.
        expect(new PostgresDbPlugin(config).databaseName)
            .toBe(new PostgresDbPlugin({ ...config }).databaseName);
    });

    it('distinguishes two databases on the same server', () => {
        const orders = new PostgresDbPlugin({ host: 'db', port: 5432, database: 'orders' });
        const billing = new PostgresDbPlugin({ host: 'db', port: 5432, database: 'billing' });

        expect(orders.databaseName).not.toBe(billing.databaseName);
    });

    it('never carries credentials, from discrete fields or a connection string', () => {
        const discrete = new PostgresDbPlugin({
            host: 'db', port: 5432, database: 'app', user: 'admin', password: 'hunter2',
        });
        const url = new PostgresDbPlugin({
            database: 'app',
            connectionString: 'postgres://admin:hunter2@db:5432/app',
        });

        // The value becomes part of a subscription channel key, and channel keys are not a
        // place secrets belong.
        expect(discrete.databaseName).not.toContain('hunter2');
        expect(url.databaseName).not.toContain('hunter2');
        expect(url.databaseName).not.toContain('admin');
        expect(url.databaseName).toContain('db');
        expect(url.databaseName).toContain('app');
    });

    it('does not throw on a connection string URL cannot parse', () => {
        // The constructor never used to throw, and a name is not worth becoming the first
        // reason it does — the userinfo is stripped by pattern instead.
        const plugin = new PostgresDbPlugin({
            database: 'db',
            connectionString: 'not a url://%%%@host/db',
        });

        expect(typeof plugin.databaseName).toBe('string');
        expect(plugin.databaseName).not.toContain('%%%');
    });
});
