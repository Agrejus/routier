/** The leader worker `PGliteWorker` proxies to. Same shape as the pglite plugin's own. */
import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';

worker({
    async init(options: { dataDir?: string }) {
        return new PGlite({ dataDir: options.dataDir });
    },
});
