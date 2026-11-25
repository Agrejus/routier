import { afterEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import type { DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import type { PluginEventCallbackResult } from '@routier/core/results';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { buildFromQueryOperation } from '../utils';

const productSchema = s.define('mysql_products', {
    id: s.string().key(),
    category: s.string(),
    price: s.number(),
}).compile();

class CapturingPlugin extends MemoryPlugin {
    statements: string[] = [];

    override query<TRoot extends {}, TShape = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, _: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.statements.push(buildFromQueryOperation(event.operation).sql);
    }
}

class Store extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

const stores: Store[] = [];

afterEach(() => {
    for (const store of stores.splice(0)) {
        store[Symbol.dispose]();
    }
});

const sqlFor = (run: (store: Store) => void): string => {
    const plugin = new CapturingPlugin('mysql-sort');
    const store = new Store(plugin);

    stores.push(store);
    run(store);

    return plugin.statements.join('\n');
};

describe('ORDER BY', () => {
    it('orders by one sort', () => {
        expect(sqlFor(store => store.products.sort(p => p.price).toArray(() => undefined))).toMatch(/ ORDER BY `price` ASC$/);
    });

    it('orders by every sort, the first one first', () => {
        expect(sqlFor(store => store.products.sort(p => p.category).sortDescending(p => p.price).toArray(() => undefined)))
            .toMatch(/ ORDER BY `category` ASC, `price` DESC$/);
    });
});
