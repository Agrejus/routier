---
title: Preact
description: "Use @routier/react in Preact through preact/compat."
---

# Preact Integration

Preact doesn't need its own package. `@routier/react` only uses `useState` and `useEffect`, and `preact/compat` provides both, so the React hook works as it is.

## Installation

```bash
npm install @routier/react preact
```

Alias `react` to `preact/compat` in your bundler. With Vite and `@preact/preset-vite`, the preset does this for you. Otherwise:

```ts
// vite.config.ts
export default {
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
    },
  },
};
```

## Usage

Import `useQuery` from `@routier/react` and use it exactly as the [React guide](/integrations/react/) describes:

```tsx
import { useQuery } from "@routier/react";
import { store, type Product } from "./inventory";

export function ProductList() {
  const products = useQuery<Product[]>((onResult) => store.products.subscribe().toArray(onResult), []);

  if (products.status !== "success") return null;

  return <ul>{products.data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

This combination is tested: a component rendered with Preact through `preact/compat` starts `pending`, receives the live result, and stops its subscription when it unmounts.
