import "dotenv/config";
import mongoose from "mongoose";
import HospitalFinance from "./models/Finance.js";

const DOCTOR_ID = "69725671a130a634d5ac0464"; // Dr. Buddhini Imbulpitiya

async function seedSuwasevana() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        // Check if Suwasevana already exists for this doctor
        const existing = await HospitalFinance.findOne({
            doctorId: DOCTOR_ID,
            name: "Suwasevana"
        });

        if (existing) {
            console.log("⚠️  Suwasevana hospital already exists for this doctor");
            console.log("Hospital ID:", existing._id);
            console.log("Records count:", existing.records?.length || 0);
        } else {
            // Create Suwasevana hospital
            const suwasevana = new HospitalFinance({
                doctorId: DOCTOR_ID,
                name: "Suwasevana",
                whtEnabled: false,
                records: []
            });

            await suwasevana.save();
            console.log("✅ Suwasevana hospital added successfully!");
            console.log("Hospital ID:", suwasevana._id);
        }

        // Show all hospitals for this doctor
        const allHospitals = await HospitalFinance.find({ doctorId: DOCTOR_ID });
        console.log("\n📊 All hospitals for Dr. Buddhini:");
        allHospitals.forEach(h => {
            console.log(`  - ${h.name} (ID: ${h._id}, Records: ${h.records?.length || 0})`);
        });

        await mongoose.connection.close();
        console.log("\n✅ Database connection closed");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

seedSuwasevana();
