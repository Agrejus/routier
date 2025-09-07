// Remove all users matching criteria
await ctx.users.where((user) => user.status === "suspended").removeAsync();

console.log("All suspended users removed");