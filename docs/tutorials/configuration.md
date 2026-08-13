---
title: Configuration
---

# Configuration

This guide covers the various configuration options available in Routier.

## Quick Navigation

- [Plugin Configuration](#plugin-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Next Steps](#next-steps)

## Plugin Configuration

### Memory Plugin

<<< @/_snippets/code/from-docs/tutorials/configuration/block-1.ts

### Local Storage Plugin

<<< @/_snippets/code/from-docs/tutorials/configuration/block-2.ts

### File System Plugin

<<< @/_snippets/code/from-docs/tutorials/configuration/block-3.ts

### PouchDB Plugin

<<< @/_snippets/code/from-docs/tutorials/configuration/block-4.ts

### Dexie Plugin

<<< @/_snippets/code/from-docs/tutorials/configuration/block-5.ts

## Advanced Configuration

### Plugin Composition

<<< @/_snippets/code/from-docs/tutorials/configuration/block-6.ts

### Custom Context Configuration

<<< @/_snippets/code/from-docs/tutorials/configuration/block-7.ts

## Environment-Specific Configuration

### Development

<<< @/_snippets/code/from-docs/tutorials/configuration/block-8.ts

### Testing

For tests, prefer the Memory plugin or mocks/stubs around persistence. The internal testing plugin is not part of the public distribution.

## Next Steps

- [Getting Started](/getting-started/overview) - Basic setup
- [Basic Example](/tutorials/basic-example) - Complete working example
- [Plugin Architecture](/integrations/plugins/create-your-own/) - Creating custom plugins
