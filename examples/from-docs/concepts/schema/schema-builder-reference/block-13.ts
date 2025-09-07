// Available on: string, number, date, boolean
s.string().distinct();
s.number().distinct();
s.date().distinct();
s.boolean().distinct();

// Not available on: object, array
// s.object({...}).distinct() // ❌ Error
// s.array(s.string()).distinct() // ❌ Error