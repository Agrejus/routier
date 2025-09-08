---
title: Installation
layout: default
parent: Getting Started
nav_order: 2
---

## Installation

Install the core libraries, the datastore, and one storage plugin.

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

Next steps:

- [Quick Start]({{ site.baseurl }}/getting-started/quick-start)
- [React Adapter]({{ site.baseurl }}/getting-started/react-adapter)
