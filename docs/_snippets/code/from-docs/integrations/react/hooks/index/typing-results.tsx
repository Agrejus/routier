import { InferType, s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { useQuery } from "@routier/react";

const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

class AppStore extends DataStore {
    products = this.collection(productSchema).proxy().create();
}

const dataStore = new AppStore(new MemoryPlugin("products-db"));

// Declare the entity type once, off the schema. Never hand-write this shape.
type Product = InferType<typeof productSchema>;

// ✅ Pass the type as the generic. `products.data` is Product[].
export function ProductList(props: { onPick: (product: Product) => void }) {
    const products = useQuery<Product[]>(
        callback => dataStore.products.subscribe().toArray(callback),
        [],
    );

    if (products.status !== "success") {
        return null;
    }

    return (
        <ul>
            {products.data.map(product => (
                <li key={product.id} onClick={() => props.onPick(product)}>
                    {product.name} — {product.price}
                </li>
            ))}
        </ul>
    );
}

// The same type works for anything downstream: props, helpers, return types.
export const totalOf = (items: Product[]): number =>
    items.reduce((sum, item) => sum + item.price, 0);

// A single item is `InferType<...>` on its own, not an array.
export function ProductName(props: { id: string }) {
    const product = useQuery<Product | undefined>(
        callback => dataStore.products
            .subscribe()
            .where(([p, params]) => p.id === params.id, { id: props.id })
            .firstOrUndefined(callback),
        [props.id],
    );

    if (product.status !== "success" || product.data == null) {
        return null;
    }

    return <span>{product.data.name}</span>;
}
