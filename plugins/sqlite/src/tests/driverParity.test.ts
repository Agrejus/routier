import { describePluginContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '../index';
import { sqlite3Driver } from '../drivers/sqlite3';

/**
 * The same 62-test plugin contract, run against the other Node engine.
 *
 * A driver interface is only worth having if two implementations of it are interchangeable,
 * and the way that claim fails is quietly: one engine coerces a type the other does not, or
 * reports a missing table with different words, or binds `undefined` where the other rejects
 * it. `sqlite3` binds `undefined` as NULL and `node:sqlite` throws on it — a difference that
 * would have broken every save of an entity with an optional property, and which only a run
 * of the full contract against both engines catches.
 *
 * `contract.test.ts` covers the default `node:sqlite` driver. This file covers `sqlite3`.
 */
describePluginContract(
    'sqlite (sqlite3 driver)',
    () => new SqliteDbPlugin(`contract-sqlite3-${uuidv4()}.sqlite`, { driver: sqlite3Driver() }),
    {
        // Same reasoning as contract.test.ts: SQLite has no native boolean, date, array or
        // object column type. The engine does not change that.
        supportsRichTypes: false,
        knownFailing: [],
    },
);
