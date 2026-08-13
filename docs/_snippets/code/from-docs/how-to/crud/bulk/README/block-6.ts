// Get users and transform them
const usersToTransform = await ctx.users
  .where((user) => user.name.includes(" "))
  .toArrayAsync();

// Transform names to title case
usersToTransform.forEach((user) => {
  user.name = user.name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  user.nameNormalized = user.name.toLowerCase().replace(/\s+/g, "-");
});