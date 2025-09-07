import { LocalStoragePlugin } from "routier-plugin-local-storage";

const localStoragePlugin = new LocalStoragePlugin(
  "my-app",
  window.localStorage
);
const sessionStoragePlugin = new LocalStoragePlugin(
  "my-app",
  window.sessionStorage
);