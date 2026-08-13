// Available on: string, number, date, boolean
s.string().identity();
s.number().identity();
s.date().identity();
s.boolean().identity();

// Not available on: object, array
// s.object({...}).identity() // ❌ Error
// s.array(s.string()).identity() // ❌ Error