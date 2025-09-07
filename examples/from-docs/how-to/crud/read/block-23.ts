// ✅ Good - leverage TypeScript for type safety
interface UserQuery {
  status: "active" | "inactive";
  minAge: number;
  maxAge: number;
}

async function queryUsers(params: UserQuery) {
  return await ctx.users
    .where((user) => user.status === params.status)
    .where((user) => user.age >= params.minAge && user.age <= params.maxAge)
    .toArrayAsync();
}

// TypeScript will catch errors at compile time
const users = await queryUsers({
  status: "active",
  minAge: 18,
  maxAge: 65,
});