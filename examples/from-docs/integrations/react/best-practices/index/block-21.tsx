// ❌ Bad
const data = useQuery(/* ... */); // Called outside component

function MyComponent() {
  return <div>{data.data}</div>;
}

// ✅ Good
function MyComponent() {
  const data = useQuery(/* ... */); // Inside component
  return <div>{data.data}</div>;
}