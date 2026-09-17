---
layout: home

hero:
  name: Routier
  text: Reactive data for any datastore
  tagline: A fast, front-end-first data toolkit with schemas, live queries, optimistic mutations, and swappable storage plugins. No lock-in, no rewrite.
  image:
    src: /routier.svg
    alt: Routier
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/quick-start
    - theme: alt
      text: Why Routier?
      link: /getting-started/why-routier
    - theme: alt
      text: Try the Playground
      link: /getting-started/playground

features:
  - icon: 📐
    title: Powerful Schemas
    details: Defaults, identity keys, indexes, computed properties, transforms, and property mapping. Bring your own validation with Zod or AJV.
    link: /concepts/schema/
    linkText: Schema guide
  - icon: 🔗
    title: Joins and Rich Queries
    details: Inner and left joins across collections, views, stores, and plugins, plus filtering, aggregation, reusable queries, full-text search, and vector similarity.
    link: /concepts/queries/
    linkText: Explore queries
  - icon: 🔄
    title: Live Queries
    details: Subscriptions push updates when data changes. Zero-config reactivity for real-time UIs with built-in change detection.
    link: /guides/live-queries
    linkText: Live queries guide
  - icon: 🌐
    title: Local-First Ready
    details: Optimistic writes, history tracking, entity tagging, and sync patterns for apps that work offline and reconcile later.
    link: /guides/local-first-apps
    linkText: Local-first guide
  - icon: ⚛️
    title: React Integration
    details: First-class hooks keep components in sync with your data. No extra state-management layer required.
    link: /integrations/react/
    linkText: React adapter
  - icon: ⚡
    title: Less Work Per Row
    details: Key lookups skip the scan. Filters run before copies. Routier generates copy functions from schemas instead of calling structuredClone.
    link: /concepts/performance
    linkText: Performance
---
