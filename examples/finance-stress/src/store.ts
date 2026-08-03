import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { accountSchema, transactionSchema, userSchema } from './schemas';

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

export class FinanceStore extends DataStore {
    users = this.collection(userSchema).proxy().create();
    accounts = this.collection(accountSchema).diff().create();
    transactions = this.collection(transactionSchema).immutable().create();

    constructor() {
        super(new MemoryPlugin(DATABASE));
    }
}

/** The UI's own store — every page reads/subscribes through this one. */
export const uiStore = new FinanceStore();
