import OpenAI from "openai";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Patient from "../models/Patient.js";
import MedicalRecord from "../models/MedicalRecord.js";
import LabRequest from "../models/LabRequest.js";
import SurgeryRecord from "../models/SurgeryRecord.js";

dotenv.config();

const openai = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
  maxRetries: 0,
});

// Same NVIDIA NIM models as the chatbot, tried in order until one answers
const MODEL_CANDIDATES = [
  { name: "google/diffusiongemma-26b-a4b-it", timeout: 8000 },
  { name: "nvidia/nemotron-3-ultra-550b-a55b", timeout: 9000 },
  { name: "meta/llama-3.2-11b-vision-instruct", timeout: 9000 },
];

// Summaries are cached per patient until their data changes (or 30 min passes),
// so reopening the card during a session doesn't spend tokens again.
const CACHE_TTL_MS = 30 * 60 * 1000;
const summaryCache = new Map();

const MAX_RECORDS = 10;
const MAX_TEXT = 300;

const trimText = (text, max = MAX_TEXT) => {
  if (!text) return "";
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

const formatDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "unknown date");

const calculateAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
};

const findPatient = async (idOrCode) => {
  if (mongoose.Types.ObjectId.isValid(idOrCode)) {
    const byId = await Patient.findById(idOrCode).select("-password");
    if (byId) return byId;
  }
  return Patient.findOne({ patientId: String(idOrCode).trim().toUpperCase() }).select("-password");
};

const loadPatientData = async (patient) => {
  const [records, labRequests, surgeries] = await Promise.all([
    MedicalRecord.find({ patientId: patient._id })
      .select("-fileData")
      .sort({ date: -1, createdAt: -1 })
      .limit(MAX_RECORDS)
      .lean(),
    LabRequest.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(MAX_RECORDS).lean(),
    patient.patientId
      ? SurgeryRecord.find({ patientId: patient.patientId.toUpperCase() })
          .select("-surgeryCardImage -entries.images")
          .sort({ updatedAt: -1 })
          .limit(3)
          .lean()
      : [],
  ]);
  return { records, labRequests, surgeries };
};

// Changes whenever a record, lab request or surgery entry is added/updated
const dataVersion = (patient, { records, labRequests, surgeries }) =>
  [
    patient.updatedAt?.getTime?.() || "",
    records.map((r) => `${r._id}:${new Date(r.updatedAt || r.createdAt).getTime()}`).join(","),
    labRequests.map((l) => `${l._id}:${l.status}`).join(","),
    surgeries.map((s) => `${s._id}:${new Date(s.updatedAt).getTime()}:${s.entries?.length || 0}`).join(","),
  ].join("|");

const buildContext = (patient, age, { records, labRequests, surgeries }) => {
  const lines = [];
  lines.push(`Patient: ${age ?? "unknown"} years, ${patient.gender || "unknown gender"}`);
  lines.push(`Known conditions: ${trimText(patient.medicalConditions) || "none recorded"}`);
  lines.push(`Allergies: ${trimText(patient.allergies) || "none recorded"}`);

  lines.push("\nRecent medical records (newest first):");
  if (records.length === 0) lines.push("- none");
  records.forEach((r) => {
    const parts = [`${formatDate(r.date)} [${r.type}] ${trimText(r.title, 80)}`];
    if (r.doctorName) parts.push(`by ${r.doctorName}`);
    if (r.diagnosis) parts.push(`diagnosis: ${trimText(r.diagnosis)}`);
    if (r.medications) parts.push(`medications: ${trimText(r.medications)}`);
    if (r.description) parts.push(`notes: ${trimText(r.description)}`);
    lines.push(`- ${parts.join("; ")}`);
  });

  lines.push("\nLab requests:");
  if (labRequests.length === 0) lines.push("- none");
  labRequests.forEach((l) => {
    const tests = (l.tests || []).map((t) => t.name).join(", ") || trimText(l.title, 80);
    lines.push(`- ${formatDate(l.createdAt)} ${tests} (${l.status})`);
  });

  if (surgeries.length > 0) {
    lines.push("\nSurgery records:");
    surgeries.forEach((s) => {
      const lastNote = s.entries?.length ? trimText(s.entries[s.entries.length - 1].notes, 200) : "";
      lines.push(`- ${formatDate(s.createdAt)} ${s.hospital || ""}${lastNote ? `; latest note: ${lastNote}` : ""}`);
    });
  }

  return lines.join("\n");
};

const SYSTEM_PROMPT = `You write pre-consultation summaries for nurses and doctors at Care101 Hospital.

RULES:
1. Use ONLY the patient data provided. Never invent diagnoses, results, medications or dates.
2. Do NOT give a diagnosis, treatment advice or recommendations. Only summarise what is recorded.
3. Write exactly 3 or 4 short bullet points, each starting with "- ", each under 25 words.
4. Cover, in order of importance: main ongoing conditions, recent visits/diagnoses, current medications, pending or recent lab tests.
5. If there is very little data, say so plainly in one bullet.
6. Output only the bullet points. No headings, no greetings, no disclaimers.`;

const parseBullets = (text) =>
  String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 4);

const generateWithAI = async (context) => {
  let lastError = null;
  for (const { name, timeout } of MODEL_CANDIDATES) {
    try {
      const completion = await openai.chat.completions.create(
        {
          model: name,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: context },
          ],
          max_tokens: 350,
          temperature: 0.1,
        },
        { timeout }
      );
      const msg = completion.choices[0]?.message;
      const bullets = parseBullets(msg?.content || msg?.reasoning_content || "");
      if (bullets.length > 0) return { bullets, model: name };
    } catch (err) {
      console.warn(`[Care101 AI] Patient summary model ${name} failed: ${err.status || "N/A"} - ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All AI models unavailable.");
};

// Plain summary built straight from the data, used when the AI is unavailable
const buildFallbackBullets = (patient, { records, labRequests }) => {
  const bullets = [];
  if (patient.medicalConditions) bullets.push(`Known conditions: ${trimText(patient.medicalConditions, 120)}`);
  const lastVisit = records.find((r) => r.type === "consultations") || records[0];
  if (lastVisit) {
    bullets.push(
      `Last record ${formatDate(lastVisit.date)}: ${trimText(lastVisit.diagnosis || lastVisit.title, 120)}`
    );
  }
  const lastRx = records.find((r) => r.medications);
  if (lastRx) bullets.push(`Recent medications: ${trimText(lastRx.medications, 120)}`);
  const pending = labRequests.filter((l) => l.status === "pending");
  if (pending.length > 0) {
    bullets.push(`Pending lab tests: ${pending.flatMap((l) => (l.tests || []).map((t) => t.name)).join(", ") || pending.length}`);
  }
  if (bullets.length === 0) bullets.push("No previous medical history recorded in Care101.");
  return bullets;
};

export const getPatientSummary = async (idOrCode, { refresh = false } = {}) => {
  const patient = await findPatient(idOrCode);
  if (!patient) return null;

  const data = await loadPatientData(patient);
  const age = calculateAge(patient.dateOfBirth);
  const version = dataVersion(patient, data);
  const cacheKey = String(patient._id);

  const cached = summaryCache.get(cacheKey);
  const fresh = cached && cached.version === version && Date.now() - cached.createdAt < CACHE_TTL_MS;

  let bullets, source;
  if (!refresh && fresh) {
    ({ bullets, source } = cached);
  } else {
    const hasHistory = data.records.length + data.labRequests.length + data.surgeries.length > 0 || patient.medicalConditions;
    if (!hasHistory) {
      // Nothing to summarise, so skip the AI call entirely
      bullets = ["No previous medical history recorded in Care101."];
      source = "data";
    } else {
      try {
        ({ bullets } = await generateWithAI(buildContext(patient, age, data)));
        source = "ai";
      } catch {
        bullets = buildFallbackBullets(patient, data);
        source = "fallback";
      }
    }
    // Don't cache fallbacks so the next open retries the AI
    if (source !== "fallback") {
      summaryCache.set(cacheKey, { version, bullets, source, createdAt: Date.now() });
    }
  }

  return {
    patientId: patient._id,
    patientCode: patient.patientId,
    fullName: patient.fullName,
    age,
    gender: patient.gender,
    // Allergies and conditions come straight from the record, never from the AI
    allergies: patient.allergies || "",
    medicalConditions: patient.medicalConditions || "",
    summary: bullets,
    source,
    counts: {
      records: data.records.length,
      pendingLabs: data.labRequests.filter((l) => l.status === "pending").length,
      surgeries: data.surgeries.length,
    },
    generatedAt: new Date(summaryCache.get(cacheKey)?.createdAt || Date.now()),
  };
};
