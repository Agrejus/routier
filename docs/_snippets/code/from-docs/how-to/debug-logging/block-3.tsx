// main.tsx – must run before any routier imports.
// Routier cannot read your import.meta.env (it is bundled with rspack, which
// replaces import.meta), so translate it into the global here.
(globalThis as any).__ROUTIER_LOG_LEVEL__ = import.meta.env?.DEV ? "debug" : "silent";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
