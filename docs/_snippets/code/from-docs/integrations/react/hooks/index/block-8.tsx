// TypeScript knows data is defined when status is 'success'
if (result.status === "success") {
  console.log(result.data); // ✅ Safe
}