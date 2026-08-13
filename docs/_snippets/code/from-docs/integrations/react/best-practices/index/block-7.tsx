interface ErrorDisplayProps {
  error: Error;
  retry?: () => void;
}

function ErrorDisplay({ error, retry }: ErrorDisplayProps) {
  return (
    <div className="error">
      <p>Something went wrong: {error.message}</p>
      {retry && <button onClick={retry}>Retry</button>}
    </div>
  );
}

// Usage
if (products.status === "error") {
  return <ErrorDisplay error={products.error} />;
}