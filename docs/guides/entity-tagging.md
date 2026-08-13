---
title: Entity Tagging
---

## Entity Tagging

Entity tagging attaches one or more tags to a write operation (insert/update/delete). Tags are propagated to the storage plugin so it can attribute the write (e.g., who performed it, which subsystem triggered it, correlation IDs).

## Quick Navigation

- [What and Why](#what-and-why)
- [Common Uses](#common-uses)
- [Basic Usage](#basic-usage)
- [Notes](#notes)
- [React Example](#react-example)

## What and why

Entity tagging attaches one or more tags to a write operation (insert/update/delete). Tags are propagated to the storage plugin so it can attribute the write (e.g., who performed it, which subsystem triggered it, correlation IDs).

## Common uses

- Track the actor or source of a change (UI click vs background job)
- Add correlation/trace IDs for observability
- Drive plugin behavior (e.g., audit logging, route-by-tag)

## Basic usage

You can tag a write by calling `tag(...)` on the collection before the write:


<<< @/_snippets/code/from-docs/guides/entity-tagging/block-1.ts


Programmatic writes can use a different tag:


<<< @/_snippets/code/from-docs/guides/entity-tagging/block-2.ts


## Notes

- Tags are pushed down to the plugin. Your plugin can read the tags during the write transaction and decide how to persist/log/route the operation.
- Tagging does not change validation or schema behavior; it annotates the transaction with context.

## React Example

The example below shows tagging user-initiated vs programmatic inserts.


<<< @/_snippets/code/from-docs/guides/entity-tagging/block-3.tsx


In your storage plugin, read the tags from the write transaction/context to record who performed the operation or to adjust persistence behavior.
