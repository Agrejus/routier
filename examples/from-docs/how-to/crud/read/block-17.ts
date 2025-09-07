// Get statistics for different user groups
const userStats = await ctx.users
  .where((user) => user.status === "active")
  .map((user) => ({
    ageGroup: user.age < 18 ? "minor" : user.age < 65 ? "adult" : "senior",
    hasProfile: !!(user.avatar && user.bio),
    isVerified: user.isVerified,
  }))
  .toArrayAsync();

// Process the results
const stats = {
  total: userStats.length,
  byAgeGroup: {
    minor: userStats.filter((u) => u.ageGroup === "minor").length,
    adult: userStats.filter((u) => u.ageGroup === "adult").length,
    senior: userStats.filter((u) => u.ageGroup === "senior").length,
  },
  withProfile: userStats.filter((u) => u.hasProfile).length,
  verified: userStats.filter((u) => u.isVerified).length,
};

console.log("User statistics:", stats);