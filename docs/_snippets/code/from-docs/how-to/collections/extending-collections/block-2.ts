import { Collection, DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import type { InferRoot, InferType } from "@routier/core/schema";

const productSchema = s
    .define("products", {
        id: s.string().key().identity(),
        name: s.string(),
        price: s.number(),
        stock: s.number(),
        category: s.string(),
    })
    .compile();

type Product = InferType<typeof productSchema>;

class ProductCollection extends Collection<InferRoot<typeof productSchema>> {
    async restockAndUpdatePriceAsync(productId: string, newStock: number, newPrice: number): Promise<Product> {
        const product = await this.firstOrUndefinedAsync(([p, params]) => p.id === params.productId, { productId });

        if (product == null) {
            throw new Error(`Product ${productId} not found`);
        }

        product.stock = newStock;
        product.price = newPrice;

        return product;
    }

    async findLowStockAsync(threshold: number = 10): Promise<Product[]> {
        return this.where(([p, params]) => p.stock <= params.threshold, { threshold }).toArrayAsync();
    }

    async bulkRestockAsync(items: { productId: string; quantity: number }[]): Promise<Product[]> {
        const restocked: Product[] = [];

        for (const item of items) {
            const product = await this.firstOrUndefinedAsync(([p, params]) => p.id === params.productId, { productId: item.productId });

            if (product != null) {
                product.stock += item.quantity;
                restocked.push(product);
            }
        }

        return restocked;
    }
}

class AppDataStore extends DataStore {
    products: ProductCollection = this.collection(productSchema).proxy().create((_, dependencies) => new ProductCollection(dependencies));

    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const ctx = new AppDataStore();

await ctx.products.restockAndUpdatePriceAsync("prod-123", 50, 29.99);
await ctx.saveChangesAsync();

await ctx.products.bulkRestockAsync([
    { productId: "prod-123", quantity: 10 },
    { productId: "prod-456", quantity: 5 },
]);
await ctx.saveChangesAsync();

const lowStock = await ctx.products.findLowStockAsync(20);
