import { OptimisticConcurrencyError } from '@routier/core';
import { FinanceStore } from './store';
import { CATEGORIES } from './schemas';
import { metrics } from './metrics';

/**
 * The load: N simulated users, each with their OWN DataStore over the shared database —
 * the many-stores-one-database shape. Every bot loop performs one business transaction:
 *
 *   pick two accounts → append a ledger row + debit one balance + credit the other
 *   → ONE saveChangesAsync()
 *
 * That save carries changes for two collections with two different tracking modes
 * (immutable add + diff updates) through one persist pipeline — the transactionality this
 * app exists to observe. Because transfers conserve money, the sum of all balances is an
 * invariant: any drift under concurrency is measured and shown, not hidden.
 */

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(items: T[]) => items[rand(items.length)];

export type SimulatorState = {
    running: boolean;
    userCount: number;
    targetTxPerSecond: number;
};

class Bot {
    private store = new FinanceStore();
    /**
     * The bot's WORKING SET: account entities read once and mutated repeatedly — the
     * realistic pattern of an app that caches what it read (or sits behind network
     * latency). Between this bot's saves, OTHER bots keep changing the same rows, so
     * every write here is computed from a stale base:
     *
     *  - UNPROTECTED: those writes silently overwrite the other bots' — money vanishes
     *    and the dashboard's drift climbs.
     *  - Wrapped in ConcurrencyDbPlugin: the stale save is REJECTED, the bot refreshes
     *    the two accounts and reapplies — drift stays $0.00 and the conflict counter
     *    shows the mechanism firing.
     */
    private cache = new Map<string, any>();
    private timer: ReturnType<typeof setTimeout> | null = null;
    private stopped = false;

    constructor(private readonly id: number) { }

    async start(intervalMs: number) {
        const accounts = await this.store.accounts.toArrayAsync() as { id: string }[];
        for (const account of accounts) {
            this.cache.set(account.id, account);
        }

        const loop = async () => {
            if (this.stopped) {
                return;
            }

            try {
                await this.transferOnce();
            } catch (error) {
                // Recorded, not just counted. A swallowed cause is why a failing backend looks
                // like a slow one: the counter climbs and nothing says what went wrong.
                metrics.noteFailedSave((error as Error)?.message ?? String(error));
            }

            // Jittered so bots do not phase-lock into synchronized save storms
            this.timer = setTimeout(loop, intervalMs * (0.5 + Math.random()));
        };

        this.timer = setTimeout(loop, rand(intervalMs));
    }

    private async transferOnce() {
        const ids = [...this.cache.keys()];
        if (ids.length < 2) {
            return;
        }

        const fromId = pick(ids);
        let toId = pick(ids);
        while (toId === fromId) {
            toId = pick(ids);
        }

        const amount = Math.round((5 + Math.random() * 245) * 100) / 100;
        const started = performance.now();

        // The ledger row is added ONCE: a failed save applies nothing AND keeps the
        // pending intent, so the queued add rides along into every retry — re-adding it
        // would double the ledger.
        await this.store.transactions.addAsync({
            fromAccountId: fromId,
            toAccountId: toId,
            amount,
            category: pick([...CATEGORIES]),
            memo: `bot ${this.id}`,
            at: new Date(),
        });

        for (let attempt = 0; attempt < 50; attempt++) {
            const from = this.cache.get(fromId);
            const to = this.cache.get(toId);

            from.balance = Math.round((from.balance - amount) * 100) / 100;
            to.balance = Math.round((to.balance + amount) * 100) / 100;

            try {
                await this.store.saveChangesAsync();
                metrics.noteSave(performance.now() - started);
                return;
            } catch (error) {
                if (!OptimisticConcurrencyError.is(error)) {
                    throw error;
                }

                metrics.noteConflict();

                // Conflict recovery: discard the stale local state (a dirty diff-tracked
                // attachment deliberately protects local edits from re-reads) and refresh
                // the working set with database truth before reapplying.
                this.store.accounts.attachments.remove(from, to);
                this.cache.set(fromId, await this.store.accounts.firstAsync(([a, p]) => a.id === p.id, { id: fromId }));
                this.cache.set(toId, await this.store.accounts.firstAsync(([a, p]) => a.id === p.id, { id: toId }));
            }
        }

        metrics.noteFailedSave();
    }

    stop() {
        this.stopped = true;
        if (this.timer != null) {
            clearTimeout(this.timer);
        }
        this.store[Symbol.dispose]();
    }
}

let bots: Bot[] = [];

export const simulator = {
    async seed(store: FinanceStore, userCount: number, accountsPerUser: number) {
        const existing = await store.accounts.countAsync();
        if (existing > 0) {
            return;
        }

        const users = [];

        for (let u = 0; u < userCount; u++) {
            const [user] = await store.users.addAsync({
                name: `User ${u + 1}`,
                email: `user${u + 1}@example.test`,
            });

            users.push(user);
        }

        /**
         * Saved BEFORE the accounts that point at them.
         *
         * `id` is `.identity()`, so the value is assigned by the backend on insert and only comes
         * back on the save. Reading `user.id` while the addition is still pending gives undefined,
         * and the accounts then reference nothing. An in-memory backend hides this by assigning
         * immediately; SQLite and PGlite cannot, which is what makes this the portable order
         * rather than a workaround.
         */
        await store.saveChangesAsync();

        for (const user of users) {
            for (let a = 0; a < accountsPerUser; a++) {
                await store.accounts.addAsync({
                    ownerId: user.id,
                    name: `${user.name} ${a === 0 ? 'Checking' : a === 1 ? 'Savings' : 'Credit'}`,
                    kind: a === 0 ? 'checking' : a === 1 ? 'savings' : 'credit',
                    balance: 1000,
                });
            }
        }

        await store.saveChangesAsync();
    },

    async start(userCount: number, targetTxPerSecond: number) {
        this.stop();

        // Spread the global rate across bots; each bot's interval is jittered in Bot.start
        const perBotInterval = Math.max(5, (userCount / targetTxPerSecond) * 1000);

        bots = Array.from({ length: userCount }, (_, i) => new Bot(i));
        await Promise.all(bots.map(bot => bot.start(perBotInterval)));
    },

    stop() {
        for (const bot of bots.splice(0)) {
            bot.stop();
        }
    },

    get running() {
        return bots.length > 0;
    },
};
