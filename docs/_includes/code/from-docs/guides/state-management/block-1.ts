class AppContext extends DataStore {
  users = this.collection(userSchema).proxy().create();
  products = this.collection(productSchema).proxy().create();
}