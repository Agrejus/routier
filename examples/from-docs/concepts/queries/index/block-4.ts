// Single field
const names = await ctx.users.map((u) => u.name).toArrayAsync();

// Reshape into a custom object
const summaries = await ctx.users
  .map((u) => ({ id: u.id, fullName: `${u.firstName} ${u.lastName}` }))
  .toArrayAsync();