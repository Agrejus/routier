const schema = s.define("users", {
  date: s.date().deserialize((str) => new Date(str)),
  price: s.number().deserialize((cents) => cents / 100),
  tags: s.string().deserialize((str) => str.split(",").filter(Boolean)),
  settings: s.string().deserialize((str) => JSON.parse(str)),
});