import type { BlogStore } from "./store";

export const listPostsWithAuthors = (store: BlogStore) =>
    store.posts
        .join((s) => s.users, (p) => p.authorId, (u) => u.id)
        .sort(([p]) => p.title)
        .toArrayAsync();
