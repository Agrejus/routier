/**
 * Polls until `fn` returns true, then resolves.
 *
 * Both the deadline and the catch are load-bearing under mutation testing: without them a
 * `fn` that throws or never becomes true kept re-arming a timer that fired AFTER the test
 * had finished, and the resulting unhandled rejection killed the whole worker process
 * instead of failing one test.
 */
export const waitFor = async (fn: () => Promise<boolean>, timeoutMs: number = 2000) => {
    return new Promise<boolean>((resolve, reject) => {
        const giveUpAt = Date.now() + timeoutMs;

        const wait = async () => {
            try {
                if (await fn()) {
                    resolve(true);
                    return;
                }

                if (Date.now() >= giveUpAt) {
                    reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
                    return;
                }

                setTimeout(wait, 50);
            } catch (e) {
                reject(e);
            }
        };

        wait();
    });
}
