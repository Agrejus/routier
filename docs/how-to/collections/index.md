---
title: Collections
layout: default
parent: Data Operations
has_children: true
nav_order: 3
---

## Collections

Task-focused guides for working with collections.

## Quick Navigation

- [Extending Collections](extending-collections.md) - Add domain-specific helpers
- [Scope Single Store](scope-single-store.md) - Use single physical store for multiple collections
- [Views](views.md) - Create read-only derived collections that auto-update

## Overview

Collections in Routier are typed entity sets backed by any storage plugin. You can extend them with custom helpers, scope them for specific use cases, and create views for derived data.

### When to Use These Guides

- **Extending Collections**: Add domain-specific helper methods while preserving typing and change tracking
- **Scope Single Store**: Configure collections to work with single-table/collection backends (e.g., PouchDB, Local Storage)
- **Views**: Create read-only derived collections that automatically update when source data changes
