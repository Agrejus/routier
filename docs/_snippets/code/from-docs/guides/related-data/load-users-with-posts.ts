import type { UserWithPosts } from "./attach-posts";
import type { BlogStore } from "./store";

export const loadUsersWithPosts = (store: BlogStore): Promise<UserWithPosts[]> =>
    store.users
        .sort((u) => u.name)
        .groupJoin((s) => s.posts, (u) => u.id, (p) => p.authorId)
        .map(([user, posts]) => ({ ...user, posts }))
        .toArrayAsync();
