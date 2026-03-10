---
title: React
layout: default
parent: Integrations
has_children: true
nav_order: 2
permalink: /integrations/react/
---

# React Integration

Routier provides first-class support for React through the `useQuery` hook, enabling reactive data fetching with automatic updates when your data changes.

<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">⚛️ Interactive React Demo</p>
  <p style="margin: 0 0 12px 0; color: #15803d;">See Routier's React integration in action with live examples of `useQuery`, live queries, and reactive updates.</p>
  <p style="margin: 0;">
    <a href="https://codesandbox.io/p/devbox/routier-4nlxsx" target="_blank" rel="noopener noreferrer" style="color: #22c55e; font-weight: 600;">Open CodeSandbox Demo →</a>
  </p>
</div>

## Features

- **Live Queries**: Automatic re-renders when data changes
- **Type Safe**: Full TypeScript support with discriminated unions
- **Performance Optimized**: Built-in memoization and cleanup handling
- **Simple API**: Minimal boilerplate, maximum productivity

## Quick Start


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/index/block-1.tsx %}{% endhighlight %}


**Important:** Your `useDataStore` hook must use `useMemo` to memoize the DataStore instance. Creating a new DataStore on every render will cause infinite subscription loops. See the [Best Practices](./best-practices/) guide for details.

## Installation

```bash
npm install @routier/react
# Install peer dependencies
npm install react react-dom
```

## Core Concepts

### useQuery Hook

The `useQuery` hook subscribes to Routier collections and returns loading, error, and success states:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/index/block-3.tsx %}{% endhighlight %}


### Automatic Updates

Queries automatically re-render when your data changes:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/index/block-4.tsx %}{% endhighlight %}


### Type Safety

TypeScript knows exactly what state your component is in:


{% highlight tsx linenos %}{% include code/from-docs/integrations/react/index/block-5.tsx %}{% endhighlight %}


## Related Topics

- **[React Hooks](./hooks/)** - Detailed guide to `useQuery` and other hooks
- **[Best Practices](./best-practices/)** - Patterns, performance tips, and common scenarios

## Concepts You'll Need

- [Live Queries](/guides/live-queries/) - Understanding live queries in depth
- [Optimistic Replication](/guides/optimistic-replication/) - Fast reads with memory replication
- [State Management](/guides/state-management/) - Managing application state
