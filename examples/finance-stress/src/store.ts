import { ConcurrencyDbPlugin } from '@routier/core/plugins';
import type { IDbPlugin } from '@routier/core/plugins';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { PGliteDbPlugin } from '@routier/pglite-plugin';
import { SqliteDbPlugin, wasmDriver } from '@routier/sqlite-plugin';
import { accountSchema, instrumentSchema, transactionSchema, userSchema } from './schemas';

/**
 * One shared database name: every FinanceStore (the UI's, and one per simulated user)
 * opens the same MemoryPlugin database, so they share the physical collections and
 * notify each other through the broadcast channels — the many-stores-one-database shape
 * a real multi-tab app has.
 *
 * The three collections deliberately use three different tracking modes:
 *  - users:        proxy     (live per-write tracking)
 *  - accounts:     diff      (plain objects, snapshot compare at save — the hot writes)
 *  - transactions: immutable (append-only ledger; reads are frozen)
 */
export const DATABASE = 'finance-stress-bank';

/**
 * The A/B switch this example exists to demonstrate: open `/?unprotected` and the store
 * runs on the bare MemoryPlugin — concurrent writers silently lose updates and the
 * dashboard's invariant drift climbs. The default (protected) build wraps the same plugin
 * in ConcurrencyDbPlugin: one wrap, a hidden per-row __version token, and stale writes are
 * rejected with OptimisticConcurrencyError instead of overwriting — the bots retry and
 * drift stays $0.00 at any user count.
 */
const QUERY = new URLSearchParams(window.location.search);

export const UNPROTECTED = QUERY.has('unprotected');

/**
 * Which storage engine the whole app runs on: `?plugin=memory|sqlite|pglite`.
 *
 * The point of the switch is that NOTHING else changes. Same schemas, same tracking modes, same
 * bots, same invariant checks — so a difference in what the dashboard reports is a difference in
 * the plugin, not in the workload. It is also what makes this a pre-publish check: the two
 * worker-backed plugins are exercised through a real bundler, a real worker and real storage,
 * which no unit test reaches.
 */
export type PluginName = 'memory' | 'sqlite' | 'pglite';

const NAMES: readonly PluginName[] = ['memory', 'sqlite', 'pglite'];

const requested = QUERY.get('plugin') as PluginName | null;

export const PLUGIN: PluginName = requested != null && NAMES.includes(requested) ? requested : 'memory';

/**
 * In-memory storage for both engines by default.
 *
 * A stress run writes continuously, and the question this app answers is about throughput and
 * correctness under concurrency, not about disks. `?persist` opts into real storage — OPFS for
 * SQLite, whatever `resolveDataDir` picks for PGlite — which is the durability path.
 */
export const PERSIST = QUERY.has('persist');

/**
 * `?codec=off` sends every read through the plugin's ordinary clone path.
 *
 * The A/B the codec's only claim needs: identical results either way. A difference between the two
 * settings, on the same workload, is a codec defect and nothing else.
 */
export const CODEC = QUERY.get('codec') !== 'off';

/** Starting load, so a run is reproducible from a URL rather than from typing into two boxes. */
const positive = (name: string, fallback: number) => {
    const value = Number(QUERY.get(name));

    return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const START_USERS = positive('users', 10);
export const START_RATE = positive('rate', 50);

const build = (): IDbPlugin => {
    if (PLUGIN === 'sqlite') {
        return new SqliteDbPlugin(DATABASE, {
            driver: wasmDriver({ storage: PERSIST ? 'opfs' : 'memory', codec: CODEC }),
        });
    }

    if (PLUGIN === 'pglite') {
        return new PGliteDbPlugin(PERSIST ? DATABASE : `memory://${DATABASE}`, { codec: CODEC });
    }

    return new MemoryPlugin(DATABASE);
};

export class FinanceStore extends DataStore {
    users = this.collection(userSchema).proxy().create();
    accounts = this.collection(accountSchema).diff().create();
    transactions = this.collection(transactionSchema).immutable().create();
    /** The market board: one writer updates through update() recipes; every component
     * reads frozen instances and detects change by reference equality. */
    instruments = this.collection(instrumentSchema).immutable().create();

    constructor() {
        const plugin = build();

        super(UNPROTECTED ? plugin : new ConcurrencyDbPlugin(plugin));
    }
}

/** The UI's own store — every page reads/subscribes through this one. */
export const uiStore = new FinanceStore();
