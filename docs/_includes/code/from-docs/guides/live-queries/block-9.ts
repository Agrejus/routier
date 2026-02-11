// Only create live query if needed
let unsubscribe: (() => void) | null = null;

if (shouldUseLiveQuery) {
  unsubscribe = ctx.users.subscribe().toArray((result) => {
    if (result.ok === "success") {
      // Handle data
    }
  }).unsubscribe;
} else {
  ctx.users.toArrayAsync().then((data) => {
    // Handle data
  });
}