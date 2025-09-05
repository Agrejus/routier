import { s } from 'routier-core';

const isNullOrEmpty = (value: unknown) => {
    return value == null || value == "";
}

export const inventoryItemsSchema = s.define("inventoryItems", {
    sku: s.string().key().identity(),
    name: s.string(),
    quantity: s.number(),
    warehouseLocation: s.string().optional(),
    restockDate: s.date().optional(),
    discontinued: s.boolean()
}).modify(w => ({
    hasCollectionName: w.computed((_, collectionName, injected) => !injected.isNullOrEmpty(collectionName), { isNullOrEmpty }).tracked(),
    wasRestocked: w.function((x, _collectioNName, injected) => !injected.isNullOrEmpty(x.restockDate != null), { isNullOrEmpty })
})).compile();