import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { fastHash, HashType } from "@routier/core";

const productsSchema = s
  .define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
    tags: s.array(s.string()),
    createdDate: s.date(),
  })
  .compile();

const productsHistorySchema = s
  .define("productsHistory", {
    id: s.string().key(),
    productId: s.string(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
    inStock: s.boolean(),
    tags: s.array(s.string()),
    createdDate: s.date(),
    documentType: s.string(),
  })
  .compile();

export class AppDataStore extends DataStore {
  products = this.collection(productsSchema).create();

  productsHistory = this.view(productsHistorySchema)
    .derive((done) => {
      return this.products.subscribe().toArray((response) => {
        if (response.ok === "error") {
          return done([]);
        }

        done(
          response.data.map((x) => ({
            // Hash the object so we can compare if anything has changed
            // This ensures a new record is inserted when anything changes
            id: fastHash(productsSchema.hash(x, HashType.Object)),
            productId: x._id,
            category: x.category,
            inStock: x.inStock,
            name: x.name,
            price: x.price,
            tags: x.tags,
            createdDate: x.createdDate,
            documentType: productsHistorySchema.collectionName,
          }))
        );
      });
    })
    .create();
}