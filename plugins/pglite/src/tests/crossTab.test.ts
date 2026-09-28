import { afterAll, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { webLock } from '../crossTabLock';
import { pgliteDbPlugin } from '../index';
import { whenPGliteCanRun } from './vmModules';

const schema = s.define('cross_tab_rows', {
    id: s.string().key(),
    tab: s.string(),
    index: s.number(),
}).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

const ROWS_PER_SAVE = 40;

const save = async (store: Store, tab: string, round: number) => {
    await store.rows.addAsync(...Array.from({ length: ROWS_PER_SAVE }, (_, index) => ({ id: `${tab}-${round}-${index}`, tab, index })));
    await store.saveChangesAsync();
};

const ROUNDS = 5;

const saveRounds = async (store: Store, tab: string) => {
    for (let round = 0; round < ROUNDS; round++) {
        await save(store, tab, round);
    }
};

whenPGliteCanRun('two tabs sharing one PGlite leader', () => {
    const engines: PGlite[] = [];

    afterAll(async () => {
        await Promise.all(engines.map(engine => engine.close()));
    });

    const tabsOverOneSession = (lockName?: string) => {
        const engine = new PGlite();
        engines.push(engine);
        const lock = lockName == null ? undefined : webLock(lockName);
        const tabA = new Store(pgliteDbPlugin('memory://leader', engine, { lock }));
        const tabB = new Store(pgliteDbPlugin('memory://leader', engine, { lock }));
        return { tabA, tabB };
    };

    it('completes overlapping saves from both tabs when they share the cross-tab lock', async () => {
        const { tabA, tabB } = tabsOverOneSession(`routier-pglite:${Math.random()}`);

        await Promise.all([saveRounds(tabA, 'a'), saveRounds(tabB, 'b')]);

        expect(await tabA.rows.countAsync()).toBe(ROWS_PER_SAVE * ROUNDS * 2);
        expect(await tabB.rows.where(row => row.tab === 'b').countAsync()).toBe(ROWS_PER_SAVE * ROUNDS);
    });

    it('interleaves the two tabs inside one transaction without it, which is the defect', async () => {
        const { tabA, tabB } = tabsOverOneSession();

        const outcomes = await Promise.allSettled([saveRounds(tabA, 'a'), saveRounds(tabB, 'b')]);

        expect(outcomes.some(outcome => outcome.status === 'rejected')).toBe(true);
    });
});
