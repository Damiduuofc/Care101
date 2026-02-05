import "dotenv/config";
import mongoose from "mongoose";
import HospitalFinance from "./models/Finance.js";
import Appointment from "./models/Appointment.js";

const DOCTOR_ID = "69725671a130a634d5ac0464"; // Dr. Buddhini Imbulpitiya

async function syncFinance() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected");

        // 1. Get current Finance Records
        const hospital = await HospitalFinance.findOne({ doctorId: DOCTOR_ID, name: "Suwasevana" });
        if (!hospital) {
            console.log("❌ No Suwasevana hospital found!");
            process.exit(1);
        }

        console.log(`\n📊 Current Finance Records: ${hospital.records.length}`);
        const existingDates = hospital.records.map(r => r.date.getTime());

        // 2. Get All Paid Appointments for this Doctor
        const paidAppointments = await Appointment.find({
            doctorId: DOCTOR_ID,
            paymentStatus: 'paid'
        });

        console.log(`\n🔎 Found ${paidAppointments.length} PAID appointments.`);

        let addedCount = 0;

        // 3. Sync Missing Records
        for (const appt of paidAppointments) {
            // Simple check: duplicate if exact same time exists
            // (Not perfect but avoids double counting the same exact second)
            const apptTime = new Date(appt.date).getTime();

            // Check if a record with this time roughly exists (within 1 second)
            const exists = existingDates.some(d => Math.abs(d - apptTime) < 1000);

            if (!exists) {
                hospital.records.unshift({
                    type: 'channeling',
                    date: appt.date,
                    patients: 1,
                    income: appt.amount || 2000 // Default to 2000 if null
                });
                console.log(`   ➕ Added record: ${new Date(appt.date).toLocaleDateString()} - ${appt.amount || 2000} LKR`);
                addedCount++;
            } else {
                console.log(`   ---- Skipped (Already exists): ${new Date(appt.date).toLocaleDateString()}`);
            }
        }

        if (addedCount > 0) {
            await hospital.save();
            console.log(`\n✅ Successfully added ${addedCount} missing records!`);
        } else {
            console.log("\n✅ All records are already in sync.");
        }

        process.exit(0);

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

syncFinance();
