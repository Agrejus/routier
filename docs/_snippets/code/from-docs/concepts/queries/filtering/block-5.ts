const productIds = ["prod-1", "prod-2", "prod-3"];

const products = await dataStore.products
  .where(([p, params]) => params.ids.includes(p.id), { ids: productIds })
  .toArrayAsync();