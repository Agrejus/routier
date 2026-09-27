import { useMemo } from "react";
import { useQuery } from "@routier/react";
import { attachPosts, type UserWithPosts } from "../attach-posts";
import { store, type Post, type User } from "../store";

export const useUsersWithPosts = (): UserWithPosts[] | undefined => {
    const users = useQuery<User[]>((callback) => store.users.subscribe().sort((u) => u.name).toArray(callback), []);

    const ids = users.status === "success" ? users.data.map((user) => user.id) : [];

    const posts = useQuery<Post[]>(
        (callback) =>
            store.posts
                .subscribe()
                .where(([p, x]) => x.ids.includes(p.authorId), { ids })
                .sort((p) => p.title)
                .toArray(callback),
        [ids.join()],
    );

    return useMemo(
        () => (users.status === "success" && posts.status === "success" ? attachPosts(users.data, posts.data) : undefined),
        [users, posts],
    );
};
