// Using callback-based API with result pattern
ctx.users.remove([userToRemove], (result) => {
  if (result.ok === "error") {
    console.error("Failed to remove user:", result.error);
    return;
  }
  console.log("User removed:", result.data);
});