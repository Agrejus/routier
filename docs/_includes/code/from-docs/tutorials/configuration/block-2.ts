import { LocalStoragePlugin } from "@routier/browser-storage-plugin";

const localStoragePlugin = new LocalStoragePlugin(
  "my-app",
  window.localStorage
);
const sessionStoragePlugin = new LocalStoragePlugin(
  "my-app",
  window.sessionStorage
);