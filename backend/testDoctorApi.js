import mongoose from "mongoose";
import "dotenv/config";
import Doctor from "./models/Doctor.js";

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const doc = await Doctor.findOne();
  console.log(doc);
  process.exit(0);
}
test();
