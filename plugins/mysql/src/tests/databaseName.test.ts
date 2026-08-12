import { describe, it, expect } from '@jest/globals';
import { MysqlDbPlugin } from '../MysqlDbPlugin';

/**
 * `IDbPlugin.databaseName` scopes subscription channels, so two instances that disagree stop
 * seeing each other's changes and two that wrongly agree cross-talk between unrelated
 * databases. Constructing the plugin builds a pool, which does not connect until a query runs.
 *
 * Unlike Postgres, this config REFUSES a connection string alongside discrete fields, so the
 * two forms are tested separately rather than together.
 */
describe('MysqlDbPlugin.databaseName', () => {

    it('includes host and port, because one database name lives on many servers', () => {
        const here = new MysqlDbPlugin({ host: 'a.example.com', port: 3306, database: 'app' });
        const there = new MysqlDbPlugin({ host: 'b.example.com', port: 3306, database: 'app' });

        expect(here.databaseName).not.toBe(there.databaseName);
        expect(here.databaseName).toContain('a.example.com');
        expect(here.databaseName).toContain('app');
    });

    it('is the same for two instances built from equal config', () => {
        const config = { host: 'db.example.com', port: 3306, database: 'app' };

        expect(new MysqlDbPlugin(config).databaseName)
            .toBe(new MysqlDbPlugin({ ...config }).databaseName);
    });

    it('distinguishes two databases on the same server', () => {
        const orders = new MysqlDbPlugin({ host: 'db', port: 3306, database: 'orders' });
        const billing = new MysqlDbPlugin({ host: 'db', port: 3306, database: 'billing' });

        expect(orders.databaseName).not.toBe(billing.databaseName);
    });

    it('never carries credentials, from discrete fields or a connection string', () => {
        const discrete = new MysqlDbPlugin({
            host: 'db', port: 3306, database: 'app', user: 'admin', password: 'hunter2',
        });
        const url = new MysqlDbPlugin({
            connectionString: 'mysql://admin:hunter2@db:3306/app',
        });

        // The value becomes part of a subscription channel key.
        expect(discrete.databaseName).not.toContain('hunter2');
        expect(url.databaseName).not.toContain('hunter2');
        expect(url.databaseName).not.toContain('admin');
        expect(url.databaseName).toContain('db');
        expect(url.databaseName).toContain('app');
    });

    it('leaves an unparseable connection string to the driver, which already rejects it', () => {
        // `createPool` parses the URI eagerly and throws, so the name derivation's own
        // regex fallback is unreachable here — unlike Postgres, whose `Pool` does not parse
        // until it connects. Pinned so the difference is a recorded fact rather than a
        // surprise the next time these two plugins are read side by side.
        expect(() => new MysqlDbPlugin({ connectionString: 'not a url://%%%@host/db' }))
            .toThrow(/Invalid URL/);
    });
});
