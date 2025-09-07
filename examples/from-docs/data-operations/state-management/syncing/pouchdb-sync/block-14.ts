onChange: (schemas, change) => {
  if (change.error) {
    console.error("Sync error:", change.error);

    // Handle specific error types
    switch (change.error.name) {
      case "unauthorized":
        handleAuthenticationError();
        break;
      case "conflict":
        handleConflictError(change.error);
        break;
      case "network_error":
        handleNetworkError(change.error);
        break;
      default:
        handleGenericError(change.error);
    }
  }
};