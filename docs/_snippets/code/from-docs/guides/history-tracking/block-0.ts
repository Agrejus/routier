import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";

const productsSchema = s
  .define("products", {
    id: s.string().key(),
    name: s.string(),
    price: s.number(),
  })
  .compile();

const productsHistorySchema = s
  .define("productsHistory", {
    id: s.string().key().identity(),
    productId: s.string(),
    operation: s.string(),
    name: s.string(),
    price: s.number(),
    changedAt: s.date(),
  })
  .compile();

export class AppDataStore extends DataStore {
  productsHistory = this.collection(productsHistorySchema).proxy().create();

  products = this.collection(productsSchema)
    .audit(productsHistorySchema)
    .derive((changes, emit) => {
      emit(
        changes.map((change) => ({
          productId: change.entity.id,
          operation: change.operation,
          name: change.entity.name,
          price: change.entity.price,
          changedAt: change.at,
        }))
      );
    })
    .proxy()
    .create();
}
