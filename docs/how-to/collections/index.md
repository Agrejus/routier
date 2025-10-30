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

- [Overview](#overview)
- [When to Use These Guides](#when-to-use-these-guides)

## Overview

Collections in Routier are typed entity sets backed by any storage plugin. You can extend them with custom helpers, scope them for specific use cases, and create views for derived data.

### When to Use These Guides

- **Extending Collections**: Add domain-specific helper methods while preserving typing and change tracking
- **Scope Single Store**: Configure collections to work with single-table/collection backends (e.g., PouchDB, Local Storage)
- **Views**: Create read-only derived collections that automatically update when source data changes
