import mongoose from "mongoose";
import dotenv from "dotenv";
import SurgeryRecord from "./models/SurgeryRecord.js";
import Doctor from "./models/Doctor.js";

dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  console.log("Connecting to:", uri);
  await mongoose.connect(uri);
  console.log("Connected!");

  const records = await SurgeryRecord.find().populate('doctorId').lean();
  console.log(`Found ${records.length} surgery records:`);
  for (const r of records) {
    console.log(`- Record ID: ${r._id}`);
    console.log(`  Patient Name field: ${r.name}`);
    console.log(`  Patient ID field: ${r.patientId}`);
    console.log(`  NIC: ${r.nic}`);
    console.log(`  Hospital: ${r.hospital}`);
    console.log(`  Doctor ID: ${r.doctorId?._id}`);
    console.log(`  Doctor Name: ${r.doctorId?.name}`);
    console.log(`  Doctor FullName: ${r.doctorId?.fullName}`);
    console.log(`  Doctor SLMC: ${r.doctorId?.slmcReg}`);
    console.log(`  Doctor Hospital: ${r.doctorId?.hospital}`);
    console.log(`  Entries count: ${r.entries?.length || 0}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
