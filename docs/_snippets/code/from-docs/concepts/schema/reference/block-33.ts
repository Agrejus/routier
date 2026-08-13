const schema = s.object({
  email: s
    .string()
    .email()
    .validate((email) => {
      // Custom business logic
      if (email.endsWith("@example.com")) {
        return "Example.com emails not allowed";
      }
      return true;
    }),
});