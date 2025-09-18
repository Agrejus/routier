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

export const seedData = async<T extends {}>(routier: DataStore, collectionSelector: () => Collection<T>, count: number = 2) => {

    const collection = collectionSelector();
    const generatedData = generateData(collection.schema, count);

    await collection.addAsync(...generatedData);
    await routier.saveChangesAsync();
}

export { generateData };