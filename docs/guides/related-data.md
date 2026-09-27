---
title: Loading Related Data
doc_role: guide
description: Load parents with their children in Routier using groupJoin, join, live queries, or a view.
---

# Loading Related Data

Routier has no declared relations and no `.include()`. A post's author is just another row, found by its key. This guide shows how to load related rows with the query API: `groupJoin` for a nested shape, `join` for flat pairs, two live queries for a UI that stays current, and a view for a shape you want stored.

## Quick navigation

- [When to use what](#when-to-use-what)
- [The example schemas](#the-example-schemas)
- [A nested shape with groupJoin](#a-nested-shape-with-groupjoin)
- [Flat pairs with a join](#flat-pairs-with-a-join)
- [Live related data in React](#live-related-data-in-react)
- [Live related data in Vue](#live-related-data-in-vue)
- [What `.foreignKey()` does today](#what-foreignkey-does-today)
- [Notes](#notes)

## When to use what

| You want | Use |
| --- | --- |
| Each parent with its children as an array, such as a user with `posts[]` | [`groupJoin`](#a-nested-shape-with-groupjoin) |
| One row per parent and child pair, such as a post list showing each author's name | [A join](#flat-pairs-with-a-join) (`join` or `leftJoin`) |
| The nested shape in a component, refreshed when either collection changes | [Two live queries](#live-related-data-in-react), combined in `useMemo` or `computed` |
| A denormalized shape stored and queried like a collection | A [view](/how-to/collections/views) derived from both collections |

## The example schemas

Every snippet below uses these two collections. `authorId` holds a user's `id`:

<<< @/_snippets/code/from-docs/guides/related-data/store.ts

## A nested shape with groupJoin

`groupJoin` returns one `[user, posts]` tuple per user, where `posts` is an array of that user's posts. Map each tuple to a plain object to get the nested shape:

<<< @/_snippets/code/from-docs/guides/related-data/load-users-with-posts.ts

Given Ada with two posts, Lin with one, and Max with none, it returns:

```ts
[
  { id: "u1", name: "Ada", posts: [{ id: "p1", authorId: "u1", title: "B post" }, { id: "p2", authorId: "u1", title: "A post" }] },
  { id: "u2", name: "Lin", posts: [{ id: "p3", authorId: "u2", title: "C post" }] },
  { id: "u3", name: "Max", posts: [] },
]
```

How it behaves:

- **Every user appears once.** A user with no posts gets `posts: []`. A post whose author isn't among the users is not returned.
- **Operators after `groupJoin` work on the groups.** `count` counts users, and `take(10)` returns 10 users with all their posts. A `where`, `sort`, or `take` before `groupJoin` applies to the user rows.
- **Posts inside a group have no guaranteed order.** `sort` orders the users. If the posts need an order, sort each `posts` array after the query returns.
- **The result is read-only.** Neither the user fields nor the posts are change-tracked. See [Notes](#notes).

`groupJoin` takes the same arguments as `join`, including a collection passed directly for a cross-store join. See the [Joins](/concepts/queries/joins) page for key rules and cost.

## Flat pairs with a join

A join returns one `[post, user]` tuple for every matching pair. It suits lists where each row needs a field or two from the other side:

<<< @/_snippets/code/from-docs/guides/related-data/flat-pairs.ts

`join` drops posts whose author doesn't exist. `leftJoin` keeps them, paired with `undefined`. A user with three posts appears in three tuples, so use `groupJoin` when you want one entry per user. Key rules, filtering, and cost are covered on the [Joins](/concepts/queries/joins) page.

## Live related data in React

`groupJoin` and `join` have no `subscribe`, so they can't drive a live query. A live nested shape uses two live queries instead, one per collection, and groups them in the component. Either collection changing produces a new result, and the component re-renders.

The grouping is a small helper typed from the schemas, so the compiler checks `authorId` and `id` against the real entity types:

<<< @/_snippets/code/from-docs/guides/related-data/attach-posts.ts

The hook reads the users, then reads only their posts by passing the ids as a parameter. Query expressions are parsed, not run as closures, so write `x.ids.includes(p.authorId)` with `{ ids }`, not a closed-over `ids` (see [Filtering](/concepts/queries/filtering)):

<<< @/_snippets/code/from-docs/guides/related-data/react/useUsersWithPosts.ts

<<< @/_snippets/code/from-docs/guides/related-data/react/UsersWithPosts.tsx

How it behaves:

- **Adding, editing, or removing a post** updates the posts query, and `useMemo` regroups.
- **Adding a user** updates the users query. The id list changes, so the posts query resubscribes for the new set of parents.
- **The posts dependency is `ids.join()`**, not `users`. Editing a user's name produces new user data but the same ids, so the posts query keeps its subscription.
- **The hook returns `undefined` until both queries succeed.** When the parent ids change, the posts query briefly returns to `pending`, and so does the combined result.

See [React hooks](/integrations/react/hooks/) for `useQuery` itself.

## Live related data in Vue

`@routier/vue` works the same way with `computed`. `useQuery` tracks the refs its query reads, so reading `ids.value` inside the posts query is enough to resubscribe when the parents change:

<<< @/_snippets/code/from-docs/guides/related-data/vue/useUsersWithPosts.ts

The `ids` computed returns its previous array when the ids haven't changed. Without that, every users update would produce a new array and resubscribe the posts query. Reading the previous value in a `computed` getter needs Vue 3.4 or later.

Use it in a component like any other computed ref:

```vue
<script setup lang="ts">
import { useUsersWithPosts } from "./useUsersWithPosts";

const users = useUsersWithPosts();
</script>

<template>
  <ul v-if="users">
    <li v-for="user in users" :key="user.id">
      {{ user.name }} ({{ user.posts.length }})
    </li>
  </ul>
</template>
```

See [Vue](/integrations/vue/) for `useQuery` itself.

## What `.foreignKey()` does today

`s.string().foreignKey(userSchema, "id")` records that `authorId` refers to a user's `id`. It is metadata only:

- It doesn't load, join, or attach anything. `groupJoin` and the other recipes take their keys from the selectors you pass, not from the schema.
- It doesn't cascade deletes or check that the referenced row exists.
- It can't be combined with `.index()` on the same property. If the child side of a join needs an index on a backend that uses one, declare `.index()` instead.

Use it to document the relationship in the schema, where anyone reading the code finds it.

## Notes

- **Join and group join results are read-only.** Neither the tuples nor the objects you map them to are change-tracked, so assigning to `user.name` or `posts[0].title` saves nothing. To edit a row, read it through its own collection.
- **In the live recipe, the posts are tracked.** `attachPosts` copies each user but keeps the posts the posts query returned, so an edit to one of those posts is saved by the next `saveChangesAsync`. To avoid surprises, edit through the collection there too.
- **Order is undefined without `sort`.** This applies to joins, to the posts inside a group, and to plain reads. Sort when order matters.
- **Bound the parents.** Every parent brings all of its children. Page the parents with `sort` and `take`, either before `groupJoin` or after it, where `take` counts parents. In the live recipe, the id list does the same job. Reading a child collection with no filter, such as `store.posts.toArrayAsync()` to group everything, reads every row on every load, and on every change when it's live.

## Related

- [Joins](/concepts/queries/joins): `join`, `leftJoin`, `groupJoin`, key rules, and cost
- [Live Queries](/guides/live-queries): subscriptions and when they fire
- [Views](/how-to/collections/views): store a derived, denormalized shape
- [Schema API](/concepts/schema/schema-api): `.foreignKey()` and the other modifiers
