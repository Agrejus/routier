import { computed, type ComputedRef } from "vue";
import { useQuery } from "@routier/vue";
import { attachPosts, type UserWithPosts } from "../attach-posts";
import { store, type Post, type User } from "../store";

const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

export const useUsersWithPosts = (): ComputedRef<UserWithPosts[] | undefined> => {
    const users = useQuery<User[]>((callback) => store.users.subscribe().sort((u) => u.name).toArray(callback));

    const ids = computed<string[]>((previous) => {
        const next = users.value.status === "success" ? users.value.data.map((user) => user.id) : [];

        return previous != null && sameIds(previous, next) ? previous : next;
    });

    const posts = useQuery<Post[]>((callback) =>
        store.posts
            .subscribe()
            .where(([p, x]) => x.ids.includes(p.authorId), { ids: ids.value })
            .sort((p) => p.title)
            .toArray(callback),
    );

    return computed(() =>
        users.value.status === "success" && posts.value.status === "success"
            ? attachPosts(users.value.data, posts.value.data)
            : undefined,
    );
};
