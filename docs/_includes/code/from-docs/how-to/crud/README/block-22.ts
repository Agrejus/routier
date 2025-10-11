import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define schema
const productSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string<"electronics" | "clothing" | "books">(),
    inStock: s.boolean().default(true),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// Create DataStore
class ProductStore extends DataStore {
  constructor() {
    super(new MemoryPlugin("products"));
  }

  products = this.collection(productSchema).create();
}

// Usage
async function manageProducts() {
  const store = new ProductStore();

  try {
    // CREATE
    const newProduct = await store.products.addAsync({
      name: "Laptop",
      price: 999.99,
      category: "electronics",
    });

    // READ
    const allProducts = await store.products.toArrayAsync();
    const electronics = await store.products
      .where((p) => p.category === "electronics")
      .toArrayAsync();

    // UPDATE
    if (newProduct) {
      newProduct.price = 899.99; // Changes tracked automatically
      newProduct.inStock = false;
    }

    // Check for changes
    const hasChanges = await store.hasChangesAsync();
    console.log("Has changes:", hasChanges);

    // SAVE - CRITICAL: Changes are NOT persisted until this is called
    if (hasChanges) {
      const result = await store.saveChangesAsync();
      console.log("Changes saved:", result);
    }

    // DELETE
    if (newProduct) {
      await store.products.removeAsync(newProduct);
      await store.saveChangesAsync(); // Must save to persist deletion
    }
  } catch (error) {
    console.error("Error managing products:", error);
  }
}