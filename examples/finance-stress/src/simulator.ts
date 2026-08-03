import { FinanceStore } from './store';
import { Account, CATEGORIES } from './schemas';
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
    private accounts: Account[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private stopped = false;

    constructor(private readonly id: number) { }

    async start(intervalMs: number) {
        this.accounts = await this.store.accounts.toArrayAsync() as Account[];
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

    private async transferOnce() {
        if (this.accounts.length < 2) {
            return;
        }

        const from = pick(this.accounts);
        let to = pick(this.accounts);
        while (to === from) {
            to = pick(this.accounts);
        }

        const amount = Math.round((5 + Math.random() * 245) * 100) / 100;

        const started = performance.now();

        // Ledger row (immutable collection) + two balance updates (diff collection),
        // one save.
        await this.store.transactions.addAsync({
            fromAccountId: from.id,
            toAccountId: to.id,
            amount,
            category: pick([...CATEGORIES]),
            memo: `bot ${this.id}`,
            at: new Date(),
        } as any);

        from.balance = Math.round((from.balance - amount) * 100) / 100;
        to.balance = Math.round((to.balance + amount) * 100) / 100;

        await this.store.saveChangesAsync();

        metrics.noteSave(performance.now() - started);
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
