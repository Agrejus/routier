import { useUsersWithPosts } from "./useUsersWithPosts";

export function UsersWithPosts() {
    const users = useUsersWithPosts();

    if (users == null) {
        return null;
    }

    return (
        <ul>
            {users.map((user) => (
                <li key={user.id}>
                    {user.name} ({user.posts.length})
                    <ul>
                        {user.posts.map((post) => (
                            <li key={post.id}>{post.title}</li>
                        ))}
                    </ul>
                </li>
            ))}
        </ul>
    );
}
