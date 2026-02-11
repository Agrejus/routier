// Use count() for counts
ctx.users.subscribe().count((result) => {
  if (result.ok === "success") {
    console.log("Count:", result.data);
  }
});

// Use toArray() for lists
ctx.users.subscribe().toArray((result) => {
  if (result.ok === "success") {
    console.log("List:", result.data);
  }
});

// Use firstOrUndefined() for single items
ctx.users.subscribe().firstOrUndefined((result) => {
  if (result.ok === "success") {
    console.log("First:", result.data);
  }
});