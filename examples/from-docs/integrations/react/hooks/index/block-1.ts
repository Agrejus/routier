type LiveQueryState<T> =
  | { status: "pending"; loading: true; error: null; data: undefined }
  | { status: "error"; loading: false; error: Error; data: undefined }
  | { status: "success"; loading: false; error: null; data: T };