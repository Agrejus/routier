// Always unsubscribe when done
const subscription = ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    // Handle data
  }
});

// Clean up
subscription.unsubscribe();