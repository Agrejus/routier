import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { nodeSqliteDriver, SqliteDbPlugin } from '../index';
import type { SqliteConnection, SqliteDriver } from '../drivers/types';
import type { SqlCacheMode } from '../queryCache';

const people = s.define('frame_people', {
    id: s.string().key(),
    name: s.string(),
    city: s.string(),
    nickname: s.string().nullable(),
    age: s.number(),
    active: s.boolean(),
}).compile();

class Store extends DataStore {
    people = this.collection(people).proxy().create();
}

type Statement = { sql: string; params: string };

const recordingDriver = (log: Statement[]): SqliteDriver => {
    const base = nodeSqliteDriver();

    return {
        ...base,
        async open(name: string): Promise<SqliteConnection> {
            const connection = await base.open(name);

            return {
                defineFunction: (name, implementation) => connection.defineFunction?.(name, implementation),
                all: async (sql, params, result) => {
                    if (sql.startsWith('SELECT')) {
                        log.push({ sql, params: JSON.stringify(params ?? []) });
                    }

                    return connection.all(sql, params, result);
                },
                run: (sql, params) => connection.run(sql, params),
                close: () => connection.close(),
            };
        },
    };
};

const ROWS = [
    { id: '1', name: 'Ada', city: 'Oslo', nickname: null, age: 31, active: true },
    { id: '2', name: 'Bo_b', city: 'Lima', nickname: 'bobby', age: 44, active: false },
    { id: '3', name: 'Cy%', city: 'Pune', nickname: 'cy', age: 25, active: true },
    { id: '4', name: 'Dee', city: 'Oslo', nickname: null, age: 52, active: false },
    { id: '5', name: 'Eve', city: 'Kobe', nickname: 'evie', age: 38, active: true },
];

type Opened = { store: Store; log: Statement[] };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-sqlite-frames-'));
const opened = new Map<SqlCacheMode, Opened>();

const open = async (mode: SqlCacheMode): Promise<Opened> => {
    const log: Statement[] = [];
    const store = new Store(new SqliteDbPlugin(path.join(dir, `${mode}.sqlite`), { driver: recordingDriver(log), sqlCache: mode }));
    await store.people.addAsync(...ROWS.map(row => ({ ...row })));
    await store.saveChangesAsync();
    log.length = 0;
    return { store, log };
};

beforeAll(async () => {
    opened.set('off', await open('off'));
    opened.set('on', await open('on'));
});

afterAll(async () => {
    for (const { store } of opened.values()) {
        await store.destroyAsync();
    }

    fs.rmSync(dir, { recursive: true, force: true });
});

type Run = (store: Store, variant: number) => Promise<string>;

const CITIES = [['Oslo'], ['Oslo', 'Lima'], ['Oslo', 'Lima', 'Kobe']];
const NICKNAMES = [null, 'cy', null];
const PARTS = ['%', '_', 'e'];

const CASES: [string, Run][] = [
    ['equality on a param', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.name === p.name, { name: ROWS[v]?.name ?? '' }).sort(x => x.id).toArrayAsync())],
    ['null and non-null equality', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.nickname === p.nickname, { nickname: NICKNAMES[v] ?? null }).sort(x => x.id).toArrayAsync())],
    ['null and non-null inequality', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.nickname !== p.nickname, { nickname: NICKNAMES[v] ?? null }).sort(x => x.id).toArrayAsync())],
    ['membership in arrays of different lengths', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => p.cities.includes(x.city), { cities: CITIES[v] ?? [] }).sort(x => x.id).toArrayAsync())],
    ['substring with pattern characters', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.name.includes(p.part), { part: PARTS[v] ?? '' }).sort(x => x.id).toArrayAsync())],
    ['prefix and suffix', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.name.startsWith(p.start) || x.city.endsWith(p.end), { start: PARTS[v] ?? '', end: 'o' }).sort(x => x.id).toArrayAsync())],
    ['boolean param', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.active === p.active, { active: v % 2 === 0 }).sort(x => x.id).toArrayAsync())],
    ['range, sort and take that varies', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: 20 + v * 5 }).sort(x => x.age).take(v + 1).toArrayAsync())],
    ['descending sort with skip and take', async (store, v) => JSON.stringify(await store.people.sortDescending(x => x.age).skip(v).take(2).toArrayAsync())],
    ['skip alone', async (store, v) => JSON.stringify(await store.people.sort(x => x.id).skip(v + 1).toArrayAsync())],
    ['projection of one property', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: v * 10 }).sort(x => x.id).map(x => ({ name: x.name })).toArrayAsync())],
    ['same projection name over another property', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: v * 10 }).sort(x => x.id).map(x => ({ name: x.city })).toArrayAsync())],
    ['projection renamed the other way', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: v * 10 }).sort(x => x.id).map(x => ({ city: x.name })).toArrayAsync())],
    ['equality sorted by another property', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.name === p.name, { name: ROWS[v]?.name ?? '' }).sort(x => x.name).toArrayAsync())],
    ['equality sorted descending', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.name !== p.name, { name: ROWS[v]?.name ?? '' }).sortDescending(x => x.id).toArrayAsync())],
    ['inequality sorted ascending', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.name !== p.name, { name: ROWS[v]?.name ?? '' }).sort(x => x.id).toArrayAsync())],
    ['a filter the database cannot render', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: v * 10 }).where(x => x.age ** 2 > 900).sort(x => x.id).toArrayAsync())],
    ['a renderable filter in the same shape', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: v * 10 }).where(x => x.age * 2 > 60).sort(x => x.id).toArrayAsync())],
    ['distinct projection', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: v * 10 }).map(x => ({ city: x.city })).distinctAsync())],
    ['count with a filter', async (store, v) => String(await store.people.where(([x, p]) => x.age < p.max, { max: 30 + v * 10 }).countAsync())],
    ['min with a filter', async (store, v) => String(await store.people.where(([x, p]) => x.city !== p.city, { city: CITIES[2]?.[v] ?? '' }).minAsync(x => x.age))],
    ['max with a filter', async (store, v) => String(await store.people.where(([x, p]) => x.city !== p.city, { city: CITIES[2]?.[v] ?? '' }).maxAsync(x => x.age))],
    ['sum with a filter', async (store, v) => String(await store.people.where(([x, p]) => x.active === p.active, { active: v === 1 }).sumAsync(x => x.age))],
    ['two chained filters', async (store, v) => JSON.stringify(await store.people.where(([x, p]) => x.age > p.min, { min: v * 10 }).where(([x, p]) => x.city !== p.city, { city: 'Lima' }).sort(x => x.id).toArrayAsync())],
    ['a literal filter and a param filter', async (store, v) => JSON.stringify(await store.people.where(x => x.age > 30).where(([x, p]) => x.id !== p.id, { id: String(v + 1) }).sort(x => x.id).toArrayAsync())],
    ['no filter at all', async store => JSON.stringify(await store.people.sort(x => x.name).toArrayAsync())],
];

const VARIANTS = [0, 1, 2, 0, 2];

const runOn = async (mode: SqlCacheMode, run: Run, variant: number): Promise<{ answer: string; statements: Statement[] }> => {
    const target = opened.get(mode);

    if (target == null) {
        throw new Error(`No store opened for ${mode}`);
    }

    target.log.length = 0;
    const answer = await run(target.store, variant);
    return { answer, statements: [...target.log] };
};

describe('cached SQL frames against a fresh build', () => {
    it.each(CASES)('%s renders the same SQL, params and rows', async (_label, run) => {
        for (const variant of VARIANTS) {
            const fresh = await runOn('off', run, variant);
            const cached = await runOn('on', run, variant);

            expect(cached).toEqual(fresh);
            expect(fresh.statements.length).toBeGreaterThan(0);
        }
    });
});
