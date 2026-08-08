import { beforeEach, describe, expect, it } from "@jest/globals";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MongoDbPlugin } from "../MongoDbPlugin";
import { FakeMongoDriver } from "./FakeMongoDriver";

/**
 * `bulkPersist` as one atomic unit.
 *
 * Before the driver grew `transaction`, a save spanning two collections applied the first and
 * could fail on the second, leaving the store's collections disagreeing while `saveChanges`
 * reported failure. The datastore's contract is that a save is all-or-nothing, and these pin
 * it — including that the save runs exactly once, since the obvious Mongo API for this
 * retries.
 */

const orders = s.define("orders", {
    _id: s.string().key().identity(),
    reference: s.string(),
}).compile();

const lines = s.define("lines", {
    _id: s.string().key().identity(),
    sku: s.string(),
    quantity: s.number(),
}).compile();

class ShopStore extends DataStore {
    orders = this.collection(orders).proxy().create();
    lines = this.collection(lines).proxy().create();
}

describe("bulkPersist atomicity", () => {

    let driver: FakeMongoDriver;

    beforeEach(() => {
        driver = new FakeMongoDriver();
    });

    const open = () => new ShopStore(new MongoDbPlugin(driver));

    it("commits writes across two collections together", async () => {
        const store = open();

        await store.orders.addAsync({ reference: "A-1" } as any);
        await store.lines.addAsync({ sku: "x", quantity: 2 } as any);
        await store.saveChangesAsync();

        expect(driver.collections.get("orders")!.documents).toHaveLength(1);
        expect(driver.collections.get("lines")!.documents).toHaveLength(1);
    });

    /**
     * The failure the transaction exists for: the second collection throws AFTER the first
     * has been written. Without a transaction the order survives and the line does not.
     */
    it("rolls the first collection back when the second fails", async () => {
        const store = open();

        await store.orders.addAsync({ reference: "A-2" } as any);
        await store.lines.addAsync({ sku: "y", quantity: 1 } as any);

        // Fail the write to `lines`, which is applied after `orders`.
        const linesCollection = await driver.collection("lines");
        linesCollection.insertMany = async () => {
            throw new Error("write failed");
        };

        await expect(store.saveChangesAsync()).rejects.toThrow(/write failed/);

        // Optional, because a rollback also undoes the collection's creation — `orders` was
        // first written inside this transaction, so afterwards it is not merely empty, it
        // does not exist. Either way nothing from the failed save survives.
        expect(driver.collections.get("orders")?.documents ?? []).toEqual([]);
    });

    /**
     * The save runs once, not once per attempt.
     *
     * Mongo's `withTransaction` helper retries on a transient error and on a commit
     * conflict. Reaching for it would make this the only backend in the repository that
     * silently repeats a save — SQLite lets `SQLITE_BUSY` abort, and the same code has to
     * fail the same way everywhere. `MongoClientDriver` therefore drives the transaction
     * explicitly, and this pins that no retry creeps back in.
     */
    it("runs the save exactly once", async () => {
        const store = open();
        await store.orders.addAsync({ reference: "A-3" } as any);
        await store.lines.addAsync({ sku: "z", quantity: 5 } as any);

        await store.saveChangesAsync();

        expect(driver.attempts).toBe(1);
        expect(driver.collections.get("orders")!.documents).toHaveLength(1);
        expect(driver.collections.get("lines")!.documents).toHaveLength(1);
    });

    it("reads back what was committed", async () => {
        const store = open();
        await store.orders.addAsync({ reference: "A-5" } as any);
        await store.saveChangesAsync();

        const reread = await open().orders.firstAsync();

        expect(reread.reference).toBe("A-5");
    });
});
