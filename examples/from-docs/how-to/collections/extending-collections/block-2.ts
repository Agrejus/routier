import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import { InferCreateType, InferType } from "@routier/core/schema";

const productSchema = s
    .define("products", {
        id: s.string().key().identity(),
        name: s.string(),
        price: s.number(),
        stock: s.number(),
        category: s.string(),
    })
    .compile();

class AppDataStore extends DataStore {
    products = this.collection(productSchema).create((Instance, ...args) => {
        return new (class extends Instance {
            constructor() {
                super(...args);
            }

            // Add a method that combines multiple operations
            async restockAndUpdatePriceAsync(productId: string, newStock: number, newPrice: number) {
                const product = await this.firstOrUndefinedAsync((p) => p.id === productId);
                if (!product) {
                    throw new Error(`Product ${productId} not found`);
                }

                product.stock = newStock;
                product.price = newPrice;

                return product;
            }

            // Add a query helper with business logic
            async findLowStockAsync(threshold: number = 10): Promise<InferType<typeof productSchema>[]> {
                return this.where((p) => p.stock <= threshold).toArrayAsync();
            }

            // Add a bulk operation helper
            async bulkRestockAsync(items: Array<{ productId: string; quantity: number }>) {
                const products = await Promise.all(
                    items.map((item) => this.firstOrUndefinedAsync((p) => p.id === item.productId))
                );

                products.forEach((product, index) => {
                    if (product) {
                        product.stock += items[index].quantity;
                    }
                });

                return products.filter((p): p is InferType<typeof productSchema> => p !== undefined);
            }
        })();
    });

    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const ctx = new AppDataStore();

// Use custom methods
await ctx.products.restockAndUpdatePriceAsync("prod-123", 50, 29.99);
const lowStock = await ctx.products.findLowStockAsync(20);
await ctx.products.bulkRestockAsync([
    { productId: "prod-123", quantity: 10 },
    { productId: "prod-456", quantity: 5 },
]);

await ctx.saveChangesAsync();
