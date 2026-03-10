// ✅ TypeScript will catch this error at compile time
function processUser(user: User) {
  console.log(user.email); // ✅ Valid - email exists on User type
  console.log(user.invalidField); // ❌ Error - property doesn't exist
}