// Transform with conditional logic
const userDisplayInfo = await ctx.users
  .map((user) => {
    const displayName = user.nickname || user.name;
    const status = user.isVerified ? "verified" : "unverified";
    const lastSeen = user.lastLogin
      ? `Last seen: ${user.lastLogin.toLocaleDateString()}`
      : "Never logged in";

    return {
      displayName,
      status,
      lastSeen,
      profileComplete: !!(user.avatar && user.bio),
    };
  })
  .toArrayAsync();