// Creates every index declared in the Mongoose models.
// Safe to run any time: it only ADDS missing indexes and never drops existing ones.
// Usage: npm run db:indexes
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const modelsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "models");
for (const file of fs.readdirSync(modelsDir).filter((f) => f.endsWith(".js"))) {
  await import(path.join(modelsDir, file));
}

await mongoose.connect(process.env.MONGO_URI);
for (const name of mongoose.modelNames()) {
  const model = mongoose.model(name);
  const before = (await model.collection.indexes().catch(() => [])).length;
  try {
    await model.createIndexes();
    const after = (await model.collection.indexes()).length;
    console.log(`${name.padEnd(22)} ${after} indexes${after > before ? `  (+${after - before} new)` : ""}`);
  } catch (err) {
    console.error(`${name.padEnd(22)} FAILED: ${err.message}`);
  }
}
await mongoose.disconnect();
