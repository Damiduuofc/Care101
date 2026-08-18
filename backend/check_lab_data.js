import mongoose from "mongoose";
import dotenv from "dotenv";
import LabRequest from "./models/LabRequest.js";
import MedicalRecord from "./models/MedicalRecord.js";
import Patient from "./models/Patient.js";
import Bill from "./models/Bill.js";

dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  console.log("Connecting to:", uri);
  await mongoose.connect(uri);
  console.log("Connected!");

  const requests = await LabRequest.find().lean();
  console.log(`Found ${requests.length} lab requests:`);
  for (const r of requests) {
    console.log(`- Request ID: ${r._id}`);
    console.log(`  Patient ID: ${r.patientId}`);
    console.log(`  Doctor ID: ${r.doctorId}`);
    console.log(`  Doctor Name: ${r.doctorName}`);
    console.log(`  Title: ${r.title}`);
    console.log(`  Description: ${r.description}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Record ID: ${r.recordId}`);
    console.log(`  Bill ID: ${r.billId}`);
  }

  const records = await MedicalRecord.find({ type: "lab_tests" }).lean();
  console.log(`\nFound ${records.length} medical records of type lab_tests:`);
  for (const r of records) {
    console.log(`- Record ID: ${r._id}`);
    console.log(`  Patient ID: ${r.patientId}`);
    console.log(`  Title: ${r.title}`);
    console.log(`  Doctor Name: ${r.doctorName}`);
    console.log(`  Description: ${r.description}`);
    console.log(`  Has fileData: ${!!r.fileData}`);
    console.log(`  FileType: ${r.fileType}`);
  }

  const bills = await Bill.find().lean();
  console.log(`\nFound ${bills.length} bills:`);
  for (const b of bills) {
    console.log(`- Bill ID: ${b._id}`);
    console.log(`  Patient ID: ${b.patientId}`);
    console.log(`  Title: ${b.title}`);
    console.log(`  Type: ${b.type}`);
    console.log(`  Amount: ${b.amount}`);
    console.log(`  Status: ${b.status}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
