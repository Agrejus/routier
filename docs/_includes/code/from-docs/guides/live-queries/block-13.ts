// Live search that updates as user types
const searchTerm = "john";
ctx.users
  .where((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()))
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Search results:", result.data);
    }
  });