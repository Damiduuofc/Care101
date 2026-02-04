import { GoogleGenerativeAI } from "@google/generative-ai";
import Doctor from '../models/Doctor.js';
import { hospitalData } from '../config/hospitalData.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Google AI Client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Helper to clean AI responses (removes markdown bolding etc)
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

    // 1. Fetch Doctor Data
    const doctors = await Doctor.find({}, 'name specialization qualifications').lean();

    const doctorListString = doctors.length > 0
      ? doctors.map(doc => `${doc.name} - ${doc.specialization} (${doc.qualifications})`).join("\n")
      : "No doctors registered yet.";

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // 2. Define System Prompt
    const systemPrompt = `You are the Care101 Hospital Assistant AI. Today is ${today}.

CORE RESPONSIBILITIES:
1. TRIAGE: Listen to symptoms and recommend a doctor from the list below.
2. ADVICE: Give basic first aid advice.

SYMPTOM MAPPING:
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
Hours: ${JSON.stringify(hospitalData.hours)}`;

    // 3. Prepare Gemini Model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Fast and cost-effective
      systemInstruction: systemPrompt
    });

    // 4. Convert OpenAI Message Format to Google Format
    // Google expects: { role: "user" | "model", parts: [{ text: "..." }] }
    // We separate the *last* message (current input) from the *history*.

    const lastUserMessage = messages[messages.length - 1].content;

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // 5. Start Chat Session
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.3,
      },
    });

    // 6. Send Message
    const result = await chat.sendMessage(lastUserMessage);
    const response = await result.response;
    let reply = response.text();

    reply = cleanResponse(reply);

    res.json({ reply });

  } catch (error) {
    console.error("Google AI Service Error:", error);
    // Handle specific Google API errors gracefully
    if (error.message?.includes("API_KEY")) {
      res.status(500).json({ error: "Server Configuration Error: Invalid API Key." });
    } else {
      res.status(500).json({ error: "AI temporarily unavailable." });
    }
  }
};