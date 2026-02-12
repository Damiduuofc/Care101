import OpenAI from 'openai';
import Doctor from '../models/Doctor.js';
import { hospitalData } from '../config/hospitalData.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize NVIDIA Client (using OpenAI SDK)
const openai = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

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

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid input: 'messages' array is required." });
    }

    // 1. Fetch Doctor Data
    const doctors = await Doctor.find({}, 'name specialization qualifications').lean();

    const doctorListString = doctors.length > 0
      ? doctors.map(doc => `${doc.name} - ${doc.specialization} (${doc.qualifications})`).join("\n")
      : "No doctors registered yet.";

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // 2. Define System Prompt
    const systemPrompt = `You are the Care101 Hospital Assistant AI. Today is ${today}.

**STRICT SYSTEM INSTRUCTIONS:**
You are a specialized medical assistant for Care101 Hospital. You MUST ONLY ALLOW questions related to:
1. **Symptom Triage**: Recommending a doctor based on user symptoms.
2. **First Aid Advice**: Providing immediate, basic medical steps for emergencies or injuries.
3. **Hospital Information**: Providing details about doctors, location, or hours.

**REFUSAL PROTOCOL:**
If the user asks about ANYTHING else (e.g., coding, general knowledge, math, creative writing, jokes, recipes, politics, etc.), you must STRICTLY REFUSE. 
- Standard Refusal Message: "I am the Care101 Hospital Assistant. I can only help with checking symptoms, recommending doctors, or providing first aid advice."

**CORE RESPONSIBILITIES:**
1. TRIAGE: Listen to symptoms and recommend the MOST APPROPRIATE doctor from the specific list below.
2. ADVICE: Give clear, concise first aid advice for the mentioned condition.

**SYMPTOM MAPPING:**
- Bleeding/Cuts/Wounds → Recommend "General Medicine" (OPD) or "General Surgeon"
- Fever/Flu/Headache → Recommend "General Medicine"
- Bone/Joint Pain → Recommend "Orthopedics"
- Chest Pain/Heart → Recommend "Cardiology" (AND WARN EMERGENCY)
- Children/Baby Issues → Recommend "Pediatrics"

**STRICT RULES:**
- **NEVER** answer general questions or chat casually.
- If the exact specialist isn't listed, recommend "General Medicine" (OPD).
- Do NOT say "no doctors available" if there are doctors in the list.
- Use plain text only (No markdown, no bolding, no bullet points).
- **MANDATORY DISCLAIMER:** Always end every response with: "(Please note: This is general information only and not a medical diagnosis.)"

**AVAILABLE DOCTORS LIST:**
${doctorListString}

**HOSPITAL INFO:**
Location: ${hospitalData.location}
Emergency: 1990
Hours: ${JSON.stringify(hospitalData.hours)}`;

    // 3. Prepare Chat Messages for NVIDIA
    const completionMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // List of NVIDIA NIM models to try
    const models = [
      "meta/llama-3.1-70b-instruct",      // Primary (High Intelligence)
      "meta/llama-3.1-8b-instruct",       // Fast Fallback
      "nvidia/nemotron-4-340b-instruct"   // NVIDIA's Own Model
    ];

    let reply = null;
    let lastError = null;

    // 4. Call NVIDIA API with Failover
    for (const modelName of models) {
      try {
        console.log(`Attempting to use model: ${modelName}`);

        const completion = await openai.chat.completions.create({
          model: modelName,
          messages: completionMessages,
          max_tokens: 300,
          temperature: 0.3,
        }, { timeout: 15000 }); // 15s timeout to auto-skip slow models

        reply = completion.choices[0].message.content;

        if (reply) {
          console.log(`✅ Success with model: ${modelName}`);
          break; // Success! Exit loop
        }

      } catch (error) {
        console.error(`❌ Model ${modelName} failed: ${error.status || 'N/A'} - ${error.message}`);
        lastError = error;
        // Continue to next model...
      }
    }

    if (!reply) {
      console.error("All models failed. Last error:", lastError);
      throw lastError || new Error("All AI models unavailable.");
    }

    reply = cleanResponse(reply);

    res.json({ reply });

  } catch (error) {
    console.error("NVIDIA AI Service Error:", error);

    // Handle specific API errors gracefully
    if (error.status === 401) {
      res.status(500).json({
        error: "Server Configuration Error: Invalid API Key.",
        message: "Please check your NVIDIA API key configuration."
      });
    } else if (error.status === 402) {
      // Handle payment/spending limit errors
      res.status(503).json({
        error: "AI service temporarily unavailable due to API credit limits.",
        message: "The API key has reached its spending limit."
      });
    } else if (error.status === 429) {
      res.status(429).json({
        error: "AI is currently busy. Please try again in a moment.",
        message: "Too many requests. Please wait a few seconds and try again."
      });
    } else {
      res.status(500).json({
        error: "AI temporarily unavailable.",
        message: "An unexpected error occurred. Please try again later."
      });
    }
  }
};