// Complex query chain
const result = await ctx.users
  .where((user) => user.status === "active")
  .sort((user) => user.createdAt)
  .skip(0)
  .take(20)
  .map((user) => ({
    id: user.id,
    name: user.name,
    daysSinceCreated: Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }))
  .toArrayAsync();