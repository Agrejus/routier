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
    private accountIds: string[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private stopped = false;

    constructor(private readonly id: number) { }

    async start(intervalMs: number) {
        const accounts = await this.store.accounts.toArrayAsync() as { id: string }[];
        this.accountIds = accounts.map(account => account.id);

        const loop = async () => {
            if (this.stopped) {
                return;
            }

            try {
                await this.transferOnce();
            } catch {
                metrics.noteFailedSave();
            }

            // Jittered so bots do not phase-lock into synchronized save storms
            this.timer = setTimeout(loop, intervalMs * (0.5 + Math.random()));
        };

        this.timer = setTimeout(loop, rand(intervalMs));
    }

    /**
     * One business transaction, with optimistic-concurrency retry.
     *
     * Balances are ALWAYS computed from a fresh read inside the attempt. When another
     * writer wins the race, the save throws OptimisticConcurrencyError — the stale local
     * state is discarded (a dirty diff-tracked attachment deliberately keeps local edits,
     * so it must be detached to accept database truth) and the whole intent is reapplied
     * against fresh values. Nothing is ever silently lost, which is what keeps the
     * dashboard's invariant drift at exactly $0.00 no matter how many writers race.
     */
    private async transferOnce() {
        if (this.accountIds.length < 2) {
            return;
        }

        const fromId = pick(this.accountIds);
        let toId = pick(this.accountIds);
        while (toId === fromId) {
            toId = pick(this.accountIds);
        }

        const amount = Math.round((5 + Math.random() * 245) * 100) / 100;
        const started = performance.now();

        for (let attempt = 0; attempt < 50; attempt++) {
            const from: any = await this.store.accounts.firstAsync(([a, p]) => a.id === p.id, { id: fromId });
            const to: any = await this.store.accounts.firstAsync(([a, p]) => a.id === p.id, { id: toId });

            // Ledger row (immutable collection) + two balance updates (diff collection),
            // one save. A failed save drops the pending ledger row too, so the retry
            // re-creates the whole transaction — exactly one ledger row per commit.
            await this.store.transactions.addAsync({
                fromAccountId: fromId,
                toAccountId: toId,
                amount,
                category: pick([...CATEGORIES]),
                memo: `bot ${this.id}`,
                at: new Date(),
            } as any);

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

                // Diff-mode conflict recovery: detach the stale instances so the next
                // read adopts database truth instead of protecting the losing edits.
                this.store.accounts.attachments.remove(from, to);
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

        for (let u = 0; u < userCount; u++) {
            const [user] = await store.users.addAsync({
                name: `User ${u + 1}`,
                email: `user${u + 1}@example.test`,
            } as any);

            for (let a = 0; a < accountsPerUser; a++) {
                await store.accounts.addAsync({
                    ownerId: (user as any).id,
                    name: `${(user as any).name} ${a === 0 ? 'Checking' : a === 1 ? 'Savings' : 'Credit'}`,
                    kind: a === 0 ? 'checking' : a === 1 ? 'savings' : 'credit',
                    balance: 1000,
                } as any);
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
