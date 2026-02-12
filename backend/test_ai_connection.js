import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '.env') });

console.log("NVIDIA API Key loaded:", process.env.NVIDIA_API_KEY ? "Yes" : "No");

const openai = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY,
});

const models = [
    "meta/llama-3.1-405b-instruct",
    "meta/llama-3.1-70b-instruct",
    "meta/llama-3.1-8b-instruct"
];

async function testModels() {
    console.log("Testing NVIDIA model connection with 10s timeout...");

    for (const model of models) {
        console.log(`\n-----------------------------------`);
        console.log(`Attempting model: ${model}`);
        try {
            const start = Date.now();
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [{ role: "user", content: "Reply 'Yes' if working." }],
                max_tokens: 50,
            }, { timeout: 10000 }); // 10s timeout
            const duration = Date.now() - start;
            console.log(`✅ SUCCESS (${duration}ms)`);
            console.log(`Response: ${completion.choices[0].message.content}`);
            return; // Exit on first success
        } catch (error) {
            console.error(`❌ FAILED: ${error.message}`);
            if (error.response) {
                console.error("Status:", error.response.status);
            }
        }
    }
    console.log("\n-----------------------------------");
    console.error("⛔ All models failed.");
}

testModels();
