import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";

// Define a discriminator that tags each record with its logical collection name
export const productsSchema = s
    .define("products", {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .modify((x) => ({
        // Persist the logical collection name for single-table/collection backends
        documentType: x.computed((_, collectionName) => collectionName).tracked(),
    }))
    .compile();

// Apply a global scope so all queries are constrained to this collection
export class AppDataStore extends DataStore {
    products = this.collection(productsSchema)
        .scope(([e, p]) => e.documentType === p.collectionName, { ...productsSchema })
        .create();
}


