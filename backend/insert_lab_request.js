import "dotenv/config";
import mongoose from "mongoose";
import LabRequest from "./models/LabRequest.js";

const MONGO_URI = process.env.MONGO_URI;

const createFakeRequest = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const newRequest = new LabRequest({
      patientId: "69b96ffac089b23f1302ec74", // Actual patient ID string, or mongoose.Types.ObjectId("...")
      doctorName: "Dr. Smith (System Generated)", // Random doctor name since we don't have a specific doctor ID
      title: "Full Blood Count",
      description: "Please check RBC and WBC",
      status: "pending"
    });

    await newRequest.save();
    console.log("Lab Request Created successfully:", newRequest);
    process.exit(0);
  } catch (error) {
    console.error("Error creating lab request:", error);
    process.exit(1);
  }
};

createFakeRequest();
