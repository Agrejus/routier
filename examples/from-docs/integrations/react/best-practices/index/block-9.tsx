interface LoadingProps {
  size?: "small" | "medium" | "large";
  message?: string;
}

function Loading({ size = "medium", message = "Loading..." }: LoadingProps) {
  return (
    <div className={`loading loading-${size}`}>
      <Spinner />
      <p>{message}</p>
    </div>
  );
}

// Usage
if (products.status === "pending") {
  return <Loading message="Loading products..." />;
}