import { generateData } from "./dataGenerator";
import { Collection, DataStore } from "@routier/datastore";

export const wait = (ms: number) => new Promise<void>((resolve) => {

    let sum = 0;
    const run = () => {
        if (sum >= ms) {
            resolve();
            return;
        }
        sum += 5;
        setTimeout(run, 5);
    }

    run();
});

/**
 * Invokes a callback-style query and resolves with what the callback received.
 *
 * Whether a plugin calls back synchronously is a property of its storage, not of the
 * query API: in-memory plugins land on the same tick, while file-system, IndexedDB, and
 * SQL plugins cannot. Asserting `toHaveBeenCalled()` directly after the call therefore
 * tests the backend's timing rather than the binding, and passes only on memory. Use
 * this to await the callback so the same assertion holds for every plugin.
 */
export const invokeCallback = <TResult>(
    invoke: (callback: (result: TResult) => void) => void,
    timeoutMs: number = 5000
) => new Promise<TResult>((resolve, reject) => {
    const timer = setTimeout(() => {
        reject(new Error(`Callback was not invoked within ${timeoutMs}ms`));
    }, timeoutMs);

    invoke((result) => {
        clearTimeout(timer);
        resolve(result);
    });
});

export const seedData = async<T extends {}>(routier: DataStore, collectionSelector: () => Collection<T>, count: number = 2) => {

    const collection = collectionSelector();
    const generatedData = generateData(collection.schema, count);

    await collection.addAsync(...generatedData);
    await routier.saveChangesAsync();
}

export { generateData };