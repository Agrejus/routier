// main.tsx – must run before any routier imports
if (import.meta.env?.DEV) {
  (globalThis as any).__ROUTIER_DEBUG__ = true;
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";