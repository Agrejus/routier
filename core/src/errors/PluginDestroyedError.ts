/**
 * A write that was accepted but never reached the database, because the plugin holding it was
 * destroyed first — or one submitted after the destroy.
 *
 * Distinct from a backend failure on purpose: nothing was attempted, so a caller that retries
 * on transient errors must not retry this one. There is no database left to retry against.
 */
export class PluginDestroyedError extends Error {

    constructor(reason: string) {
        super(`The plugin was destroyed: ${reason}`);
        this.name = "PluginDestroyedError";
    }
}
