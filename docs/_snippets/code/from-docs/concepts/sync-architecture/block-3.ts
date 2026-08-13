interface TableChangeTimestamp {
  tableName: string;
  lastChangeTimestamp: number;   // Server-generated timestamp (monotonic)
}