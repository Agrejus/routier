const searchTerm = "laptop";
const category = "electronics";
const minPrice = 100;

const results = await dataStore.products
  .where(
    ([p, params]) =>
      p.name.toLowerCase().includes(params.searchTerm.toLowerCase()) &&
      p.category === params.category &&
      p.price >= params.minPrice,
    { searchTerm, category, minPrice }
  )
  .toArrayAsync();