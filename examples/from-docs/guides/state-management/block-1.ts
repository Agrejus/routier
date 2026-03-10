class AppContext extends DataStore {
  users = this.collection(userSchema).create();
  products = this.collection(productSchema).create();
}