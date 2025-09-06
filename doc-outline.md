# Documentation Outline

- Overview

- docs/index.md: High-level introduction
- docs/README.md: Repo docs entry

- Getting Started

- getting-started/overview.md: Overview and key links
- getting-started/installation.md: Install and setup
- getting-started/quick-start.md: Minimal example
- getting-started/react-adapter.md: React usage

- Concepts

- concepts/index.md
- Schema
  - concepts/schema/index.md: Core ideas
  - concepts/schema/creating-a-schema.md: Define schemas
  - concepts/schema/property-types/README.md: Types (Array, Boolean, Date, Number, Object, String)
  - concepts/schema/modifiers/README.md: Property modifiers (Default, Deserialize, Distinct, Identity, Index, Key, Nullable, Optional, Readonly, Serialize, Tracked)
  - concepts/schema/modifiers/collection-modifiers.md: Collection modifiers (Computed, Function; use Tracked to persist computed)
  - concepts/schema/reference.md: Reference guide
  - concepts/schema/schema-builder-reference.md: Builder API reference
  - concepts/schema/why-schemas.md: Rationale
- Queries
  - concepts/queries/index.md: Query model
  - concepts/queries/natural-queries.md: Function-based filters
  - concepts/queries/expressions/: Expression engine
  - concepts/queries/query-options/: Options & execution
- Data pipeline
  - concepts/data-pipeline/: Flow and stages
- Collections
  - concepts/data-collections/memory-collections.md: In-memory
- Change tracking & history
  - concepts/change-tracking/: Tracking model
  - concepts/history-management/: History/undo/redo
- Relationships

  - concepts/entity-relationships/: Relations model

- Guides

- guides/index.md: Guides landing
- guides/live-queries.md
- guides/optimistic-updates.md
- guides/state-management.md
- guides/data-manipulation.md
- guides/history-tracking.md
- guides/syncing.md
- guides/entity-tagging.md

- How-To

- how-to/crud/README.md: CRUD overview
  - how-to/crud/create.md
  - how-to/crud/read.md
  - how-to/crud/update.md
  - how-to/crud/delete.md
  - how-to/crud/bulk/README.md
- how-to/collections/index.md
  - how-to/collections/extending-collections.md
- how-to/state-management/
  - live-queries/
  - syncing/
    - index.md
    - pouchdb-sync.md
  - change-tracking/
  - entity-tagging/
  - optimistic-updates/
- how-to/performance/
- how-to/error-handling/

- API

- api/index.md: API landing
- reference/api/
- reference/configuration/
- reference/errors/
- reference/migration/

- Integrations

- integrations/plugins/built-in-plugins/
  - dexie/
  - pouchdb/
  - sqlite/
  - file-system/
  - local-storage/
  - memory/README.md
  - testing/
- integrations/plugins/advanced-plugins/
  - logging/
  - query-translation/
  - replication/
- integrations/plugins/create-your-own/
- integrations/react/hooks/

- Tutorials

- tutorials/index.md
- tutorials/installation.md: Install and setup
- tutorials/getting-started.md: First project and basics
- tutorials/configuration.md: Config patterns
- tutorials/basic-example.md: End-to-end example

- Examples

- examples/basic/
- examples/advanced/
- examples/performance/
- examples/real-world/

- Demos

- demos/code-sandboxes/
- demos/interactive/
- demos/performance-benchmarks/

- Contributing
- docs/CONTRIBUTING.md
