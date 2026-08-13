import { FinanceStore } from './store';
import { Instrument } from './schemas';
import { metrics } from './metrics';

/**
 * The single writer for the market board — the "one user updating values" half of the
 * immutable propagation test.
 *
 * Every change goes through `update()` recipes on the IMMUTABLE collection: the feed never
 * mutates an instance, it describes the next one. Two immutable-mode properties are
 * exercised deliberately:
 *
 *  - The feed holds its GENERATION-1 references forever. `update()` resolves rows by id,
 *    so a stale reference is a perfectly good handle — no re-reading between ticks.
 *  - `updatedAt` is stamped inside the recipe, which is what lets every subscribed
 *    component measure true write→render propagation latency.
 */

const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const symbolFor = (index: number) =>
    `${SYMBOLS[Math.floor(index / 26) % 26]}${SYMBOLS[index % 26]}${SYMBOLS[(index * 7) % 26]}`;

class MarketFeed {
    private store = new FinanceStore();
    /** Generation-1 references, kept for the life of the feed on purpose. */
    private refs: Instrument[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private stopped = false;

    async seed(store: FinanceStore, count: number) {
        const existing = await store.instruments.countAsync();
        if (existing > 0) {
            return;
        }

        for (let i = 0; i < count; i++) {
            await store.instruments.addAsync({
                symbol: symbolFor(i),
                price: Math.round((20 + Math.random() * 480) * 100) / 100,
                change: 0,
                updatedAt: new Date(),
            } as any);
        }

        await store.saveChangesAsync();
    }

    async start(updatesPerSecond: number) {
        this.stop();
        this.stopped = false;

        this.refs = await this.store.instruments.toArrayAsync() as Instrument[];

        // A tick updates a batch of rows in ONE save; ticks are paced to hit the target
        // update rate without a save per row.
        const batchSize = Math.max(1, Math.min(10, Math.round(updatesPerSecond / 20)));
        const intervalMs = (batchSize / updatesPerSecond) * 1000;

        const tick = async () => {
            if (this.stopped) {
                return;
            }

            try {
                const started = performance.now();

                for (let i = 0; i < batchSize; i++) {
                    const ref = this.refs[Math.floor(Math.random() * this.refs.length)];

                    this.store.instruments.update(ref, previous => {
                        const drift = previous.price * (Math.random() - 0.5) * 0.01;
                        const price = Math.max(0.01, Math.round((previous.price + drift) * 100) / 100);

                        return {
                            ...previous,
                            price,
                            change: Math.round((price - previous.price) * 100) / 100,
                            updatedAt: new Date(),
                        };
                    });
                }

                await this.store.saveChangesAsync();
                metrics.noteSave(performance.now() - started);
            } catch {
                metrics.noteFailedSave();
            }

            this.timer = setTimeout(tick, intervalMs);
        };

        this.timer = setTimeout(tick, intervalMs);
    }

    stop() {
        this.stopped = true;
        if (this.timer != null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    get running() {
        return this.timer != null && this.stopped === false;
    }
}

export const marketFeed = new MarketFeed();
