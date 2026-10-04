import express from "express";
import Instruction from "../models/Instruction.js";
import { auth } from "../middleware/auth.js";
import multer from "multer"; 
import path from "path";     
import crypto from "crypto";
import InstructionShare from "../models/InstructionShare.js";
import Doctor from "../models/Doctor.js";

const router = express.Router();

// ==========================================
// 1. MULTER CONFIG
// ==========================================
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/"); 
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// ==========================================
// 2. ROUTES
// ==========================================

// GET All Instructions
router.get("/", auth, async (req, res) => {
  try {
    const list = await Instruction.find({ doctor: req.user.id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) { res.status(500).send("Server Error"); }
});

// CREATE New Instruction (Limit Removed)
router.post("/", auth, async (req, res) => {
  try {
    const { surgeryName, description } = req.body;
    const newInstruction = new Instruction({
      doctor: req.user.id,
      surgeryName,
      description
    });
    const saved = await newInstruction.save();
    res.json(saved);
  } catch (err) { res.status(500).send("Server Error"); }
});

// GET Single Instruction
router.get("/:id", auth, async (req, res) => {
  try {
    const item = await Instruction.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).send("Server Error"); }
});

// ✅ ADDED: DELETE ENTIRE INSTRUCTION
// This fixes the "Delete Surgery" button in your app
router.delete("/:id", auth, async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ msg: "Not found" });

    // Optional: Add logic here to delete the associated files from 'uploads/' folder using fs.unlink
    
    await Instruction.findByIdAndDelete(req.params.id);
    res.json({ msg: "Instruction deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// DELETE Specific File (Video/Audio/Doc)
router.delete("/:id/:section/:type", auth, async (req, res) => {
  try {
    const { id, section, type } = req.params;
    
    const updateField = section === "preOp" ? `preOp.${type}` : `postOp.${type}`;

    const updated = await Instruction.findByIdAndUpdate(
      id,
      { $set: { [updateField]: null } }, 
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// UPDATE: Upload Route
router.put("/:id/:section/:type", auth, upload.single("file"), async (req, res) => {
  try {
    const { id, section, type } = req.params;
    
    if (!req.file) return res.status(400).send("No file uploaded");

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const updateField = section === "preOp" ? `preOp.${type}` : `postOp.${type}`;

    const updated = await Instruction.findByIdAndUpdate(
      id,
      { $set: { [updateField]: fileUrl } },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// CREATE Share Token for Instruction (Requires Auth)
router.post("/:id/share", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { expireDays, section } = req.body;
    
    const instruction = await Instruction.findById(id);
    if (!instruction) {
      return res.status(404).json({ msg: "Instruction not found" });
    }

    const days = [30, 60, 90].includes(Number(expireDays)) ? Number(expireDays) : 30;
    const sec = ["preOp", "postOp"].includes(section) ? section : "preOp";
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const token = crypto.randomBytes(16).toString("hex");

    const newShare = new InstructionShare({
      instruction: id,
      section: sec,
      token,
      expiresAt
    });

    await newShare.save();

    res.json({
      token,
      expiresAt
    });
  } catch (err) {
    console.error("Error creating instruction share:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. PUBLIC SHARE ENDPOINTS
// ==========================================

// Helper: Escape HTML strings to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper: Convert stored media URL to match the current request host
function getMediaUrl(rawUrl, req) {
  if (!rawUrl) return "";
  try {
    let pathname = rawUrl;
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      const parsed = new URL(rawUrl);
      pathname = parsed.pathname;
    }
    const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    return `${proto}://${req.get("host")}${cleanPath}`;
  } catch {
    return rawUrl;
  }
}

// Helper: Render section block HTML
function renderSectionHtml(title, accentClass, bgHeaderClass, files, req) {
  const videoUrl = getMediaUrl(files?.video, req);
  const audioUrl = getMediaUrl(files?.audio, req);
  const docUrl = getMediaUrl(files?.document, req);
  const hasFiles = videoUrl || audioUrl || docUrl;

  return `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
      <div class="px-5 py-4 ${bgHeaderClass} border-b border-slate-100 flex items-center gap-3">
        <div class="w-2.5 h-6 rounded-full ${accentClass}"></div>
        <h2 class="text-lg font-bold text-slate-900">${title} Instructions</h2>
      </div>
      <div class="p-5 space-y-6">
        ${!hasFiles ? `
          <p class="text-slate-400 text-sm italic py-2">No audio, video, or documents uploaded for this section.</p>
        ` : `
          ${videoUrl ? `
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                <span>Video Instruction</span>
              </div>
              <div class="relative rounded-xl overflow-hidden bg-black aspect-video shadow-inner">
                <video src="${videoUrl}" controls playsinline preload="metadata" class="w-full h-full object-contain"></video>
              </div>
            </div>
          ` : ''}

          ${audioUrl ? `
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                <span>Audio Instruction</span>
              </div>
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <audio src="${audioUrl}" controls preload="metadata" class="w-full"></audio>
              </div>
            </div>
          ` : ''}

          ${docUrl ? `
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>Reference Document</span>
              </div>
              <a href="${docUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200/80 rounded-xl group shadow-sm">
                <div class="flex items-center gap-3">
                  <div class="bg-red-50 text-red-600 p-2.5 rounded-lg border border-red-100">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-800 group-hover:text-cyan-600 transition-colors">View PDF Document</p>
                    <p class="text-xs text-slate-500">Tap to open or download</p>
                  </div>
                </div>
                <svg class="w-5 h-5 text-slate-400 group-hover:text-cyan-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </a>
            </div>
          ` : ''}
        `}
      </div>
    </div>
  `;
}

// Helper: Render friendly error HTML
function renderErrorHtml(title, message, isExpired = false) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title} | CareLink</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 min-h-screen flex items-center justify-center p-6 text-center font-sans antialiased">
      <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div class="mx-auto w-14 h-14 ${isExpired ? 'bg-amber-50 text-amber-500 border border-amber-100' : 'bg-red-50 text-red-500 border border-red-100'} rounded-full flex items-center justify-center mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <h1 class="text-xl font-bold text-slate-900 mb-2">${title}</h1>
        <p class="text-slate-600 text-sm mb-6 leading-relaxed">${message}</p>
        <div class="text-xs text-slate-400 border-t border-slate-100 pt-4">
          Please contact your medical care provider or hospital to request a new QR code or access link.
        </div>
      </div>
    </body>
    </html>
  `;
}

// Controller: Render full patient instruction HTML view
export async function handlePatientInstructionsView(req, res) {
  try {
    const { token } = req.params;

    const share = await InstructionShare.findOne({ token }).populate({
      path: "instruction",
      populate: {
        path: "doctor",
        select: "name slmcReg specialization"
      }
    });

    if (!share || !share.instruction) {
      return res.status(404).send(renderErrorHtml(
        "Instructions Not Found",
        "The requested surgery care instructions could not be found or have been removed."
      ));
    }

    if (new Date() > share.expiresAt) {
      const expDate = new Date(share.expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      return res.status(410).send(renderErrorHtml(
        "Access Expired",
        `This instruction link expired on ${expDate}.`,
        true
      ));
    }

    const { instruction, section, expiresAt } = share;
    const doctor = instruction.doctor || {};
    const formattedExpiry = new Date(expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const formattedUpdated = new Date(instruction.createdAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

    const showPreOp = !section || section === "preOp";
    const showPostOp = !section || section === "postOp";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(instruction.surgeryName)} - Care Instructions | CareLink</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; }
        </style>
      </head>
      <body class="bg-slate-50 text-slate-800 pb-12 antialiased">
        <!-- Header -->
        <header class="bg-white border-b border-slate-100 sticky top-0 z-50 px-6 py-4 shadow-sm flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              C
            </div>
            <span class="font-extrabold text-xl tracking-tight text-slate-900">CareLink</span>
          </div>
          <div class="flex items-center gap-1.5 text-xs font-semibold text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-full border border-cyan-100">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Patient Portal</span>
          </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-md mx-auto px-4 pt-6 space-y-6">
          <!-- Surgery Intro Card -->
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <span class="text-xs font-bold text-cyan-600 uppercase tracking-wider bg-cyan-50 px-2.5 py-1 rounded-md">Surgery Care Plan</span>
            <h1 class="text-2xl font-black text-slate-900 mt-3 mb-2 leading-tight">
              ${escapeHtml(instruction.surgeryName)}
            </h1>

            ${doctor.name ? `
              <div class="mt-2 text-slate-600 text-sm">
                <p class="font-semibold text-slate-800">${escapeHtml(doctor.name)}</p>
                ${doctor.specialization ? `<p class="text-xs text-slate-400 capitalize">${escapeHtml(doctor.specialization)}</p>` : ''}
                ${doctor.slmcReg ? `
                  <p class="text-xs text-cyan-700 font-bold mt-1 bg-cyan-50/50 inline-block px-2 py-0.5 rounded border border-cyan-100/50">
                    SLMC No: ${escapeHtml(doctor.slmcReg)}
                  </p>
                ` : ''}
              </div>
            ` : ''}

            <div class="flex items-center gap-2 text-slate-400 text-xs mt-4 pt-4 border-t border-slate-50">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>Updated: ${formattedUpdated}</span>
            </div>
          </div>

          <!-- Description / Overview Section -->
          ${instruction.description ? `
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-2">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Overview / Notes</h3>
              <p class="text-slate-700 text-sm leading-relaxed whitespace-pre-line">${escapeHtml(instruction.description)}</p>
            </div>
          ` : ''}

          <!-- Pre-Op Section -->
          ${showPreOp ? renderSectionHtml("Pre-Operative", "bg-blue-500", "bg-blue-50/50", instruction.preOp, req) : ''}

          <!-- Post-Op Section -->
          ${showPostOp ? renderSectionHtml("Post-Operative", "bg-emerald-500", "bg-emerald-50/50", instruction.postOp, req) : ''}

          <!-- Footer Expiry & Info -->
          <div class="text-center space-y-2 py-4 text-xs text-slate-400 border-t border-slate-200/60 pt-6">
            <p class="text-slate-500 font-semibold flex items-center justify-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Access valid until: <span class="text-slate-700 font-bold">${formattedExpiry}</span>
            </p>
            <p class="font-medium text-slate-500">CareLink Health Systems</p>
            <p>Please consult your surgeon directly if you experience any complications.</p>
          </div>
        </main>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Error rendering patient instruction view:", err);
    res.status(500).send(renderErrorHtml("Server Error", "An error occurred while loading instructions."));
  }
}

// GET Instruction Details by Share Token (JSON API)
router.get("/share/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const share = await InstructionShare.findOne({ token }).populate({
      path: "instruction",
      populate: {
        path: "doctor",
        select: "name slmcReg specialization"
      }
    });
    if (!share || !share.instruction) {
      return res.status(404).json({ msg: "Invalid or expired access token." });
    }

    if (new Date() > share.expiresAt) {
      return res.status(410).json({ msg: "This access token has expired." });
    }

    res.json({
      instruction: share.instruction,
      section: share.section
    });
  } catch (err) {
    console.error("Error fetching shared instruction:", err);
    res.status(500).send("Server Error");
  }
});

// Direct HTML view routes inside instruction router
router.get("/patient/:token", handlePatientInstructionsView);
router.get("/share/:token/page", handlePatientInstructionsView);
router.get("/view/:token", handlePatientInstructionsView);

export default router;