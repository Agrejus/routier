// ✅ Return the unsubscribe handler (required for cleanup)
const currentUserQuery = useQuery<User | undefined>(
  (callback) => {
    return dataStore.users
      .subscribe()
      .where(([u, p]) => u.userRef === p.sub, { sub: user.sub })
      .firstOrUndefined(callback);
  },
  [dataStore, user?.sub, shouldRunUserQueries]
);