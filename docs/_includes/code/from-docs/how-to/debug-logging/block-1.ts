// At the very top of your entry file (main.ts, main.tsx, index.ts)
(globalThis as any).__ROUTIER_DEBUG__ = true;

import { DataStore } from "@routier/datastore";
// ... rest of your app