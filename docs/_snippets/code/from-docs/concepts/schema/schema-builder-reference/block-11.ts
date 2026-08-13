// Available on: string, number, date
s.string().key();
s.number().key();
s.date().key();

// Not available on: boolean, object, array
// s.boolean().key()     // ❌ Error
// s.object({...}).key() // ❌ Error
// s.array(s.string()).key() // ❌ Error