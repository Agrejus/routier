const schema = s.object({
  type: s.literal("individual", "company"),
  companyName: s.string().validate((name, entity) => {
    if (entity.type === "company" && !name) {
      return "Company name required for company type";
    }
    return true;
  }),
});