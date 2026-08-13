// Live paginated results
const pageSize = 10;
const currentPage = 0;

ctx.users
  .skip(currentPage * pageSize)
  .take(pageSize)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Current page:", result.data);
    }
  });

// This will update when users are added/removed/modified
// affecting the current page