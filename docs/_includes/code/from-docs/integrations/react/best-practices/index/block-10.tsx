function ProductSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-image"></div>
      <div className="skeleton-title"></div>
      <div className="skeleton-description"></div>
    </div>
  );
}

// Usage
if (products.status === "pending") {
  return Array(3)
    .fill(0)
    .map((_, i) => <ProductSkeleton key={i} />);
}