import OpenAI from 'openai';
import Doctor from '../models/Doctor.js'; 
import { hospitalData } from '../config/hospitalData.js';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Helper to clean AI responses
const cleanResponse = (text) => {
  return text
    .replace(/\*\*/g, '') 
    .replace(/\*/g, '') 
    .replace(/#{1,6}\s/g, '') 
    .replace(/```[\s\S]*?```/g, '') 
    .trim();
};

export const chatWithAI = async (req, res) => {
  try {
    const { messages } = req.body;
    const recentMessages = messages.slice(-10);

    // ✅ FIX 1: Fetch ALL doctors (removed { isAvailable: true })
    // This ensures the AI always has a list of names to recommend.
    const doctors = await Doctor.find({}, 'name specialization qualifications').lean();

    const doctorListString = doctors.length > 0
      ? doctors.map(doc => `${doc.name} - ${doc.specialization} (${doc.qualifications})`).join("\n")
      : "No doctors registered yet.";

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // ✅ FIX 2: Added "Symptom Mapping" to the prompt
    // This teaches the AI which department handles "Bleeding" if it can't find a Surgeon.
    const systemPrompt = `You are the Care101 Hospital Assistant AI. Today is ${today}.

CORE RESPONSIBILITIES:
1. TRIAGE: Listen to symptoms and recommend a doctor from the list below.
2. ADVICE: Give basic first aid advice.

SYMPTOM MAPPING (Use this to pick the right doctor):
- Bleeding/Cuts/Wounds → Recommend "General Medicine" (OPD) or "General Surgeon"
- Fever/Flu/Headache → Recommend "General Medicine"
- Bone/Joint Pain → Recommend "Orthopedics"
- Chest Pain/Heart → Recommend "Cardiology" (AND WARN EMERGENCY)
- Children/Baby Issues → Recommend "Pediatrics"

STRICT RULES:
- If the exact specialist isn't listed, recommend "General Medicine" (OPD).
- Do NOT say "no doctors available" if there are doctors in the list.
- Use plain text only (No markdown).
- Always add: "(Please note: This is general information only and not a medical diagnosis.)"

AVAILABLE DOCTORS LIST:
${doctorListString}

HOSPITAL INFO:
Location: ${hospitalData.location}
Emergency: 1990
Hours: ${JSON.stringify(hospitalData.hours)}

EXAMPLE RESPONSE:
User: "My leg is bleeding"
Assistant: "Please apply pressure to stop the bleeding and elevate your leg. If it is deep, go to the ER immediately. For treatment, I recommend seeing Dr. [Name] in our General Medicine department. Would you like to book an appointment? (Please note: This is general information only and not a medical diagnosis.)"
`;

    const completion = await openai.chat.completions.create({
      model: "mistralai/devstral-2512:free",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages
      ],
      temperature: 0.3, 
      max_tokens: 300,
    });

    let reply = completion.choices[0].message.content;
    reply = cleanResponse(reply);

    res.json({ reply });

  } catch (error) {
    console.error("AI Service Error:", error.message);
    res.status(500).json({ error: "AI temporarily unavailable." });
  }
};