const createDynamicSchema = (fields: string[]) => {
  const properties: Record<string, any> = {
    id: s.string().key().identity(),
  };

  fields.forEach((field) => {
    properties[field] = s.string();
  });

  return s.object(properties).compile();
};