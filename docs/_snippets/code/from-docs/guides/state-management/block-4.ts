const stats = {
  totalUsers: await ctx.users.countAsync(),
  activeUsers: await ctx.users.where((u) => u.isActive).countAsync(),
};