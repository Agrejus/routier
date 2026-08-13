const schema = s.define("users", {
  date: s.date().serialize((date) => date.toISOString()),
  price: s.number().serialize((price) => Math.round(price * 100)),
  tags: s.array(s.string()).serialize((tags) => tags.join(",")),
  settings: s
    .object({
      theme: s.string(),
      language: s.string(),
    })
    .serialize((settings) => JSON.stringify(settings)),
});