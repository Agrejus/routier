import React from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// 1) Define schema
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// 2) Create a store (singleton for the app)
class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("routier-docs"));
  }

  users = this.collection(userSchema).create();
}

export const ctx = new AppContext();

// 3) Component with two flows: UI and programmatic
export function UsersDemo() {
  const addFromUi = async () => {
    await ctx.users
      .tag("ui:clicked:add-user") // tag who/what triggered
      .addAsync({ name: "James", email: "james.demeuse@gmail.com" });
    await ctx.saveChangesAsync();
  };

  const addFromSystem = async () => {
    await ctx.users
      .tag("system:import") // programmatic / background tag
      .addAsync({ name: "Imported", email: "import@example.com" });
    await ctx.saveChangesAsync();
  };

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={addFromUi}>Add User (UI)</button>
      <button onClick={addFromSystem}>Add User (System)</button>
    </div>
  );
}