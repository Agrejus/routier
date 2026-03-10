import { DataStore } from "@routier/datastore";
import { productsSchema } from "./schemas/product";
import { productsViewSchema } from "./schemas/productsView";

export class AppDataStore extends DataStore {
  products = this.collection(productsSchema).create();

  productsView = this.view(productsViewSchema)
    .scope(([x, p]) => x.documentType === p.collectionName, productsViewSchema)
    .derive((done) => {
      return this.products.subscribe().toArray((productsResponse) => {
        if (productsResponse.ok === "error") {
          return done([]);
        }

        done(
          productsResponse.data.map((x) => ({
            id: `view:${x._id}`, // Predictable ID for updates
            category: x.category,
            inStock: x.inStock,
            name: x.name,
            price: x.price,
            tags: x.tags,
            createdDate: x.createdDate,
            documentType: productsViewSchema.collectionName,
          }))
        );
      });
    })
    .create();
}