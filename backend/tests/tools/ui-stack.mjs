// Starts an in-memory MongoDB seeded with demo queue data, for UI QA. Usage: node tests/tools/ui-stack.mjs
// Logins (password "Pass@1234"): nimali@qa.lk / kamal@qa.lk (nurses), rec@qa.lk (receptionist)
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
const { MongoMemoryServer } = await import("mongodb-memory-server");
const { default: mongoose } = await import("mongoose");
const { default: bcrypt } = await import("bcryptjs");
const { default: Admin } = await import("../../models/Admin.js");
const { default: Doctor } = await import("../../models/Doctor.js");
const { default: Schedule } = await import("../../models/ScheduleRequest.js");
const { default: Appointment } = await import("../../models/Appointment.js");
const { assignQueueToken } = await import("../../utils/queueToken.js");

const mongod = await MongoMemoryServer.create({ instance: { port: 27099 } });
await mongoose.connect(mongod.getUri());
const password = await bcrypt.hash("Pass@1234", 10);
for (const [name, role] of [["Nimali", "nurse"], ["Kamal", "nurse"], ["Rec", "receptionist"]])
  await Admin.create({ name, email: `${name.toLowerCase()}@qa.lk`, password, role });
const day = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const doc = await Doctor.create({ name: "Perera", email: "perera@d.lk", password, slmcReg: "S1", isApproved: true, isArrived: true, lastArrivalDate: new Date() });
const s = await Schedule.create({ doctorId: doc._id, doctorName: "Perera", date: day(0), startTime: day(0, 1), endTime: day(23, 58), status: "approved", allocatedNurse: "Nimali", allocatedRoom: "Room 1" });
for (const paid of ["paid", "pending", "paid", "paid"]) {
  const a = new Appointment({ patientId: new mongoose.Types.ObjectId(), doctorId: doc._id, doctorName: "Perera", department: "General", date: day(10), status: "confirmed", paymentStatus: paid, scheduleId: s._id });
  await assignQueueToken(a); await a.save();
}
console.log("READY", mongod.getUri());
setInterval(() => {}, 1 << 30);
