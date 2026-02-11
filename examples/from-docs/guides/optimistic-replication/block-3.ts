import { OptimisticReplicationDbPlugin } from "@routier/core/plugins/replication";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DexiePlugin } from "@routier/dexie-plugin";
import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";

// Define schemas
const vehicleSchema = s
  .define("vehicles", {
    id: s.string().key().identity(),
    make: s.string(),
    model: s.string(),
    year: s.number(),
  })
  .compile();

const maintenanceSchema = s
  .define("maintenance", {
    id: s.string().key().identity(),
    vehicleId: s.string(),
    description: s.string(),
    cost: s.number(),
  })
  .compile();

// Create the optimistic replication plugin
const plugin = new OptimisticReplicationDbPlugin({
  read: new MemoryPlugin("demo-optimistic-memory"),
  source: new DexiePlugin("demo-optimistic-db"),
  replicas: [],
});

export class VehicleDataStore extends DataStore {
  constructor() {
    super(plugin);
  }

  // Collections use scoping for single-store backends
  vehicles = this.collection(vehicleSchema)
    .scope(([x, p]) => x.collectionName === p.collectionName, vehicleSchema)
    .create();

  maintenance = this.collection(maintenanceSchema)
    .scope(([x, p]) => x.collectionName === p.collectionName, maintenanceSchema)
    .create();
}

export const ctx = new VehicleDataStore();

// Use it like a normal DataStore
async function example() {
  // Add a vehicle
  const vehicle = await ctx.vehicles.addAsync({
    make: "Tesla",
    model: "Model 3",
    year: 2023,
  });
  await ctx.saveChangesAsync(); // Persists to Dexie, replicates to memory

  // Read is lightning fast from memory!
  const allVehicles = await ctx.vehicles.toArrayAsync();

  // Queries are instant
  const teslaVehicles = await ctx.vehicles
    .where((v) => v.make === "Tesla")
    .sort((v) => v.year)
    .toArrayAsync();
}