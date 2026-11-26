import { Collection, DataStore } from "@routier/datastore";
import type { CollectionDependencies } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import type { InferRoot, InferType } from "@routier/core/schema";

const orderSchema = s
    .define("orders", {
        id: s.string().key().identity(),
        total: s.number(),
        placedAt: s.date().optional(),
    })
    .compile();

type OrderRoot = InferRoot<typeof orderSchema>;
type Order = InferType<typeof orderSchema>;

interface Clock {
    now(): Date;
}

class OrderCollection extends Collection<OrderRoot> {
    constructor(dependencies: CollectionDependencies<OrderRoot>, private readonly clock: Clock) {
        super(dependencies);
    }

    async placeAsync(total: number): Promise<Order> {
        const [order] = await this.addAsync({ total, placedAt: this.clock.now() });
        return order;
    }
}

class AppDataStore extends DataStore {
    readonly orders: OrderCollection;

    constructor(clock: Clock) {
        super(new MemoryPlugin("app"));
        this.orders = this.collection(orderSchema).proxy().create((_, dependencies) => new OrderCollection(dependencies, clock));
    }
}

const ctx = new AppDataStore({ now: () => new Date() });
await ctx.orders.placeAsync(42);
await ctx.saveChangesAsync();

const fixedClock: Clock = { now: () => new Date("2026-01-01T00:00:00Z") };
const testCtx = new AppDataStore(fixedClock);
const order = await testCtx.orders.placeAsync(10);
console.log(order.placedAt?.toISOString());
