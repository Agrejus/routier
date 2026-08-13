async function getUsersPage(page: number, pageSize: number = 10) {
  const skip = (page - 1) * pageSize;

  const users = await ctx.users
    .sort((user) => user.name)
    .skip(skip)
    .take(pageSize)
    .toArrayAsync();

  // Get total count for pagination info
  const totalUsers = await ctx.users.countAsync();
  const totalPages = Math.ceil(totalUsers / pageSize);

  return {
    users,
    pagination: {
      currentPage: page,
      pageSize,
      totalUsers,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// Usage
const page1 = await getUsersPage(1, 10);
console.log(`Page 1: ${page1.users.length} users`);
console.log(`Total pages: ${page1.pagination.totalPages}`);