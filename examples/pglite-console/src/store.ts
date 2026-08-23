import { DataStore } from '@routier/datastore';
import { PGliteDbPlugin } from '@routier/pglite-plugin';
import { productSchema } from './schemas';

/**
 * A bare name, so the plugin picks `opfs-ahp://`. Prefix it to choose otherwise:
 * `idb://pglite-console` for Safari, `memory://pglite-console` to lose the data on reload.
 */
export const DATABASE_NAME = 'pglite-console';

export class ShopStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

export const openStore = () => new ShopStore(new PGliteDbPlugin(DATABASE_NAME));
