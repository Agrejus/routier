/**
 * Rolling metrics for the stress run. Plain module state polled by the UI once a second —
 * deliberately NOT reactive, so measuring does not itself generate load.
 */

type Listener = () => void;

const saveLatencies: number[] = [];
let committedTransactions = 0;
let failedSaves = 0;
let concurrencyConflicts = 0;
let subscriptionDeliveries = 0;
let windowStart = performance.now();
let windowTx = 0;
let windowDeliveries = 0;
let txPerSecond = 0;
let deliveriesPerSecond = 0;

let frames = 0;
let fps = 0;
let fpsWindowStart = performance.now();
let rafHandle: number | null = null;

const listeners = new Set<Listener>();

export const metrics = {
    noteSave(latencyMs: number) {
        committedTransactions++;
        windowTx++;
        saveLatencies.push(latencyMs);
        if (saveLatencies.length > 5000) {
            saveLatencies.splice(0, saveLatencies.length - 5000);
        }
    },

    noteFailedSave() {
        failedSaves++;
    },

    noteConflict() {
        concurrencyConflicts++;
    },

    noteDelivery() {
        subscriptionDeliveries++;
        windowDeliveries++;
    },

    snapshot() {
        const sorted = [...saveLatencies].sort((a, b) => a - b);
        const at = (q: number) => sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

        return {
            committedTransactions,
            failedSaves,
            concurrencyConflicts,
            subscriptionDeliveries,
            txPerSecond,
            deliveriesPerSecond,
            saveP50: at(0.5),
            saveP95: at(0.95),
            saveP99: at(0.99),
            fps,
        };
    },

    /** Called once a second by the panel; rolls the rate windows. */
    tick() {
        const now = performance.now();
        const elapsed = (now - windowStart) / 1000;

        if (elapsed >= 1) {
            txPerSecond = windowTx / elapsed;
            deliveriesPerSecond = windowDeliveries / elapsed;
            windowTx = 0;
            windowDeliveries = 0;
            windowStart = now;
        }

        for (const listener of listeners) {
            listener();
        }
    },

    onTick(listener: Listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    startFpsMeter() {
        if (rafHandle != null) {
            return;
        }

        const loop = () => {
            frames++;
            const now = performance.now();

            if (now - fpsWindowStart >= 1000) {
                fps = Math.round((frames * 1000) / (now - fpsWindowStart));
                frames = 0;
                fpsWindowStart = now;
            }

            rafHandle = requestAnimationFrame(loop);
        };

        rafHandle = requestAnimationFrame(loop);
    },
};
