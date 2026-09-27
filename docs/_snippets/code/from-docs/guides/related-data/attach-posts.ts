import type { Post, User } from "./store";

export type UserWithPosts = User & { posts: Post[] };

export const groupPostsByAuthor = (posts: Post[]): Map<string, Post[]> => {
    const groups = new Map<string, Post[]>();

    for (const post of posts) {
        const group = groups.get(post.authorId);

        if (group == null) {
            groups.set(post.authorId, [post]);
        } else {
            group.push(post);
        }
    }

    return groups;
};

export const attachPosts = (users: User[], posts: Post[]): UserWithPosts[] => {
    const postsByAuthor = groupPostsByAuthor(posts);

    return users.map((user) => ({ ...user, posts: postsByAuthor.get(user.id) ?? [] }));
};
