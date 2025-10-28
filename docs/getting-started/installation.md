---
title: Installation
layout: default
parent: Getting Started
nav_order: 2
---

## Installation

Install the core libraries, the datastore, and one storage plugin.

## Quick Navigation

- [Install Core and Datastore](#1-install-core-and-datastore)
- [Pick a Plugin](#2-pick-a-plugin)
- [Next Steps](#next-steps)

### 1) Install core and datastore

```bash
npm install @routier/core @routier/datastore
```

### 2) Pick a plugin (one or more)

Example:

```bash
npm install @routier/memory-plugin
```

Other plugins are available (Local Storage, File System, Dexie, SQLite, PouchDB). See the list at:

- [Built‑in Plugins]({{ site.baseurl }}/integrations/plugins/built-in-plugins/)

## Next Steps

- [Quick Start]({{ site.baseurl }}/getting-started/quick-start) - Build a working example in minutes
- [React Adapter]({{ site.baseurl }}/getting-started/react-adapter) - Use Routier with React
