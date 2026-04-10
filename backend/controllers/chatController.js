import OpenAI from 'openai';
import Doctor from '../models/Doctor.js';
import Schedule from '../models/ScheduleRequest.js'; // ← ADD THIS IMPORT
import { hospitalData } from '../config/hospitalData.js';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

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

    // 2. Fetch Schedule Data (today + next 7 days), only approved schedules
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const upcomingSchedules = await Schedule.find({
      status: 'approved',
      date: { $gte: todayStart, $lte: weekEnd }
    }).lean();

    // 3. Format Schedule Data into readable string for the AI
    const formatTime = (isoDate) => {
      if (!isoDate) return 'N/A';
      return new Date(isoDate).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Colombo' // adjust to your hospital's timezone
      });
    };

    const formatDate = (isoDate) => {
      if (!isoDate) return 'N/A';
      return new Date(isoDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Colombo'
      });
    };

    // Group schedules by doctor name for clean output
    const scheduleByDoctor = {};
    for (const s of upcomingSchedules) {
      const name = s.doctorName;
      if (!scheduleByDoctor[name]) scheduleByDoctor[name] = [];
      scheduleByDoctor[name].push(s);
    }

    let scheduleInfoString = '';
    if (upcomingSchedules.length === 0) {
      scheduleInfoString = 'No approved schedules found for the upcoming week.';
    } else {
      for (const [doctorName, sessions] of Object.entries(scheduleByDoctor)) {
        scheduleInfoString += `\nDoctor: ${doctorName}\n`;
        for (const s of sessions) {
          const sessionDate = formatDate(s.date);
          const start = formatTime(s.startTime);
          const end = formatTime(s.endTime);
          const queue = s.isUnlimited ? 'Unlimited patients' : `Max ${s.queueLimit} patients`;
          scheduleInfoString += `  - Date: ${sessionDate} | Time: ${start} to ${end} | Queue: ${queue}\n`;
        }
      }
    }

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'Asia/Colombo'
    });

    // 4. Define System Prompt
    const systemPrompt = `You are the Care101 Hospital Assistant AI. Today is ${today}.

STRICT SYSTEM INSTRUCTIONS:
You are a specialized medical assistant for Care101 Hospital. You MUST ONLY answer questions related to:
1. Symptom Triage: Recommending a doctor based on user symptoms.
2. First Aid Advice: Providing immediate, basic medical steps for emergencies.
3. Hospital Information: Details about doctors, location, hours, or schedules.
4. Doctor Schedules: Telling patients when a specific doctor is available today or this week.

REFUSAL PROTOCOL:
If the user asks about ANYTHING else (e.g., coding, general knowledge, math, creative writing, jokes, recipes, politics), STRICTLY REFUSE.
Standard Refusal: "I am the Care101 Hospital Assistant. I can only help with checking symptoms, recommending doctors, first aid advice, or doctor availability."

SCHEDULE ANSWERING RULES:
- If a patient asks "Is Dr. [Name] available today?" check the schedule data below and answer with the session time and queue limit for today only.
- If a patient asks "When is Dr. [Name] available this week?" or "What sessions does Dr. [Name] have upcoming?" list all their sessions from the schedule data below.
- If a doctor has no sessions in the data, say they have no approved sessions scheduled for this week.
- Always mention the time (start to end) and how many patients are allowed per session.
- If the patient does not specify a doctor, and asks "who is available today?" list all doctors with sessions today.

SYMPTOM MAPPING:
- Bleeding/Cuts/Wounds → General Medicine (OPD) or General Surgeon
- Fever/Flu/Headache → General Medicine
- Bone/Joint Pain → Orthopedics
- Chest Pain/Heart → Cardiology (WARN: SEEK EMERGENCY IMMEDIATELY)
- Children/Baby Issues → Pediatrics
- If specialist not listed → recommend General Medicine (OPD)

STRICT RULES:
- NEVER answer general questions or chat casually.
- Use plain text only. No markdown, no bullet points, no bolding.
- MANDATORY DISCLAIMER: Always end every response with: "(Please note: This is general information only and not a medical diagnosis.)"

AVAILABLE DOCTORS:
${doctorListString}

UPCOMING APPROVED SCHEDULES (Today through next 7 days):
${scheduleInfoString}

HOSPITAL INFO:
Location: ${hospitalData.location}
Emergency: 1990
Hours: ${JSON.stringify(hospitalData.hours)}`;

    // 5. Prepare messages
    const completionMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const models = [
      "meta/llama-3.1-70b-instruct",
      "nvidia/nemotron-4-340b-instruct",
      "meta/llama-3.1-8b-instruct"
    ];

    let reply = null;
    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`Attempting to use model: ${modelName}`);

        const completion = await openai.chat.completions.create({
          model: modelName,
          messages: completionMessages,
          max_tokens: 400, // slightly increased for schedule responses
          temperature: 0.3,
        }, { timeout: 15000 });

        reply = completion.choices[0].message.content;

        if (reply) {
          console.log(`✅ Success with model: ${modelName}`);
          break;
        }

      } catch (error) {
        console.error(`❌ Model ${modelName} failed: ${error.status || 'N/A'} - ${error.message}`);
        lastError = error;
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

    if (error.status === 401) {
      res.status(500).json({ error: "Server Configuration Error: Invalid API Key." });
    } else if (error.status === 402) {
      res.status(503).json({ error: "AI service temporarily unavailable due to API credit limits." });
    } else if (error.status === 429) {
      res.status(429).json({ error: "AI is currently busy. Please try again in a moment." });
    } else {
      res.status(500).json({ error: "AI temporarily unavailable. Please try again later." });
    }
  }
};
