import { DataStore } from '@routier/datastore';
import { PGliteDbPlugin } from '@routier/pglite-plugin';
import { resolveDataDir } from '@routier/pglite-plugin/browser-storage';
import { productSchema } from './schemas';

/**
 * A bare name, so the plugin picks the fastest storage that persists on this browser: OPFS,
 * or IndexedDB on WebKit. Prefix it to overrule that — `memory://pglite-console` to lose the
 * data on reload.
 */
export const DATABASE_NAME = 'pglite-console';

export class ShopStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

/** What the plugin resolved the bare name to, so the UI can show where the data really is. */
export const DATA_DIR = resolveDataDir(DATABASE_NAME, navigator.userAgent);

export const openStore = () => new ShopStore(new PGliteDbPlugin(DATABASE_NAME));
