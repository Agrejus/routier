// Create a live query
const subscription = ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log(result.data);
  }
});

// Later, unsubscribe to stop updates
subscription.unsubscribe();