import OpenAI from 'openai';
import Doctor from '../models/Doctor.js';
import Schedule from '../models/ScheduleRequest.js';
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

    // 1. Fetch Doctor Data grouped by department/specialization
    const doctors = await Doctor.find({}, 'name specialization qualifications').lean();

    const doctorsByDept = {};
    doctors.forEach(doc => {
      if (!doctorsByDept[doc.specialization]) {
        doctorsByDept[doc.specialization] = [];
      }
      doctorsByDept[doc.specialization].push(doc);
    });

    let doctorInfoString = 'AVAILABLE DOCTORS BY DEPARTMENT:\n';
    if (doctors.length > 0) {
      for (const [dept, doctorList] of Object.entries(doctorsByDept)) {
        doctorInfoString += `\n${dept}:\n`;
        doctorList.forEach(doc => {
          doctorInfoString += `  - Dr. ${doc.name} (${doc.qualifications})\n`;
        });
      }
    } else {
      doctorInfoString += 'No doctors registered yet.';
    }

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

    // 3. Format Schedule Data
    const formatTime = (isoDate) => {
      if (!isoDate) return 'N/A';
      return new Date(isoDate).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Colombo'
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

    // Group schedules by doctor name
    const scheduleByDoctor = {};
    for (const s of upcomingSchedules) {
      const name = s.doctorName;
      if (!scheduleByDoctor[name]) scheduleByDoctor[name] = [];
      scheduleByDoctor[name].push(s);
    }

    let scheduleInfoString = 'DOCTOR CHANNELING SCHEDULES (Next 7 days):\n';
    if (upcomingSchedules.length === 0) {
      scheduleInfoString += 'No approved channeling schedules available for the upcoming week.';
    } else {
      for (const [doctorName, sessions] of Object.entries(scheduleByDoctor)) {
        scheduleInfoString += `\nDr. ${doctorName}:\n`;
        for (const s of sessions) {
          const sessionDate = formatDate(s.date);
          const start = formatTime(s.startTime);
          const end = formatTime(s.endTime);
          const queue = s.isUnlimited ? 'Unlimited patient slots' : `Maximum ${s.queueLimit} patients`;
          scheduleInfoString += `  - ${sessionDate} | ${start} to ${end} | ${queue}\n`;
        }
      }
    }

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Colombo'
    });

    // 4. Define Improved System Prompt
    const systemPrompt = `You are the Care101 Hospital Assistant AI. Today is ${today}.

=== YOUR ROLE ===
You are a health information assistant for Care101 Hospital. You help patients by:
1. Providing general health information (non-diagnostic)
2. Recommending appropriate hospital departments based on symptoms
3. Listing available doctors in recommended departments
4. Providing doctor channeling schedules when patients ask
5. Giving basic first aid guidance for emergencies

=== WHAT YOU CAN ANSWER ===
✓ Health-related questions and general medical information
✓ Symptom assessment to suggest appropriate department
✓ Available doctors and their specializations
✓ Doctor channeling schedules and appointment availability
✓ First aid advice for emergencies
✓ Hospital location, hours, and contact information

=== WHAT YOU CANNOT ANSWER ===
✗ General knowledge (history, geography, science)
✗ Coding, mathematics, creative writing
✗ Jokes, recipes, politics, or non-health topics
✗ Specific medical diagnoses (you are NOT a doctor)
✗ Treatment plans or prescription recommendations

=== RESPONSE RULES ===
1. Use plain text only - NO markdown, NO bold, NO bullet points, NO emojis
2. Be clear and helpful but NOT medical advice
3. Always include disclaimer: "(Please note: This is general information only and not a medical diagnosis.)"
4. Keep responses concise and easy to understand

=== DEPARTMENT & SYMPTOM MAPPING ===
These are common symptom-to-department mappings (not exhaustive):

GENERAL MEDICINE:
  - Fever, flu, cough, cold
  - Headache, body pain
  - General checkup or health concerns
  
CARDIOLOGY:
  - Chest pain (⚠️ EMERGENCY - advise immediate ER visit)
  - Heart palpitations, shortness of breath
  - Blood pressure concerns
  
ORTHOPEDICS:
  - Bone fractures, joint pain
  - Back pain, neck pain
  - Sports injuries, arthritis
  
PEDIATRICS:
  - Child/baby health issues
  - Child fever, cough, digestive issues
  - Growth and development concerns
  
GENERAL SURGERY:
  - Cuts, wounds, bleeding
  - Surgical concerns
  - Abdominal pain (non-emergency)

EMERGENCY CASES (⚠️ ALWAYS RECOMMEND IMMEDIATE ER):
  - Severe chest pain
  - Difficulty breathing
  - Severe bleeding
  - Loss of consciousness
  - Severe accidents/trauma

=== HOW TO HANDLE COMMON REQUESTS ===

Request: "I have [symptom], which department should I go to?"
Response: 
  1. Acknowledge their symptoms
  2. Recommend appropriate department(s)
  3. List available doctors in that department
  4. Mention if channeling schedules are available

Request: "Is Dr. [Name] available for channeling?"
Response:
  1. Check if doctor exists and has schedules
  2. If yes: Show all available dates, times, and patient slots
  3. If no: Say "Dr. [Name] has no approved channeling schedules available this week. Please check back later or try another doctor."

Request: "Who is available today?"
Response:
  1. List only doctors with schedules TODAY
  2. Show their times and available slots
  3. If none: "No doctors have approved channels scheduled for today. Check back tomorrow or view the full weekly schedule."

Request: "Tell me about [health condition]"
Response:
  1. Provide general health information (what it is, common symptoms)
  2. Suggest which department might help
  3. Recommend when to seek medical attention
  4. Never diagnose or prescribe

Request: Non-health topic
Response: "I am the Care101 Hospital Assistant. I can only help with health-related questions, doctor availability, and hospital information. Is there anything health-related I can assist you with?"

=== TONE ===
- Friendly and helpful
- Professional but not cold
- Reassuring but not dismissive
- Direct and clear

=== AVAILABLE DOCTORS ===
${doctorInfoString}

=== CHANNELING SCHEDULES (Next 7 Days) ===
${scheduleInfoString}

=== HOSPITAL INFORMATION ===
Location: ${hospitalData.location}
Emergency Hotline: 1990
Operating Hours: ${JSON.stringify(hospitalData.hours)}`;

    // 5. Prepare messages
    const completionMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const models = [
      "meta/llama-3.1-8b-instruct",
      "meta/llama-3.1-70b-instruct",
      "nvidia/nemotron-4-340b-instruct"
    ];

    let reply = null;
    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`Attempting to use model: ${modelName}`);

        const completion = await openai.chat.completions.create({
          model: modelName,
          messages: completionMessages,
          max_tokens: 500,
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
