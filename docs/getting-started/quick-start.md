---
title: Quick Start
---

## Quick Start

Spin up a minimal project and see live queries and optimistic updates in action.

<div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
  <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">🎯 Try This Example Live</p>
  <p style="margin: 0 0 12px 0; color: #1e3a8a;">Use the live playground immediately, or open its CodeSandbox workspace to inspect and change the source.</p>
  <p style="margin: 0;">
    <a href="https://4nlxsx-5180.csb.app/" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; font-weight: 600;">Open Live Playground →</a>
    <span style="margin: 0 8px; color: #93c5fd;">|</span>
    <a href="https://codesandbox.io/p/devbox/routier-4nlxsx" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; font-weight: 600;">View and Edit Code →</a>
  </p>
</div>

## Quick Navigation

- [Quick Setup](#quick-setup-memory-plugin)
- [What's Next?](#whats-next)

### Quick setup (Memory plugin)


<<< @/_snippets/code/from-docs/getting-started/quick-start/block-1.ts

Note the last few lines. Query results are already typed from the schema, so you rarely
annotate anything. When you do want to name the entity type — a function parameter, a React
prop, an API payload — get it from the schema with `InferType<typeof userSchema>` rather than
writing an interface by hand, which then has to be kept in step with the schema. See
[InferType](/concepts/schema/infer-type).

## What's Next?

- **[Learn About Schemas](/concepts/schema/)** - Define your data structure
- **[Explore Queries](/concepts/queries/)** - Query and filter data
- **[Try Live Queries](/guides/live-queries)** - Build reactive UIs
- **[Use with React](/getting-started/react-adapter)** - React integration
