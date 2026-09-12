# Care101 Healthcare Platform — Full Technical System Specification & AI Context Manual

> **Purpose of this Document:**  
> This specification document serves as an exhaustive, definitive technical reference for an autonomous AI agent, LLM-based coding assistant, or software engineer working on the **Care101** codebase. It contains the complete architectural blueprint, data dictionary, domain logic, API contract catalog, role-based workflows, and implementation nuances.

---

## 1. Executive System Overview

**Care101** (internally branded as *SUWASEWANA HOSPITAL / Care101 Hospital*) is an enterprise healthcare management ecosystem designed for private hospitals and clinical practices, primarily localized for Sri Lanka (incorporating national SLMC doctor registrations, National Identity Cards [NIC], and the Sri Lankan `1990` emergency infrastructure).

The system seamlessly integrates:
1. **Administrative Staff & Clinical Ops** (Web App / Next.js 15) for Hospital Admins, Receptionists, Nurses, and Lab Technicians.
2. **Clinical Doctors & Specialists** (Mobile App / Expo React Native) for managing schedules, viewing patient medical histories, tracking live queues, monitoring surgical records, issuing lab orders, and managing hospital earnings.
3. **Patients** (Mobile App & Web View) for booking appointments, tracking real-time queue position with dynamic arrival-time predictions, viewing bills & paying via Stripe, and reviewing digital medical records and surgical care instructions.
4. **Autonomous AI Clinical Assistant** (NVIDIA Integrate LLM API / Meta LLaMA 3.2 & Nemotron) offering 24/7 symptom triage, department routing, doctor schedule lookup, and strict safety guardrails.

---

## 2. Monorepo Repository Architecture

The project is structured as a unified monorepo divided into three distinct runtime layers:

```
Care101/
├── backend/                  # REST API, WebSocket server, Database Models, Background Tasks
│   ├── config/               # Database connection, hospital static metadata
│   ├── controllers/          # Authentication, password reset, AI assistant controller
│   ├── middleware/           # JWT verification, Role-based authorization
│   ├── models/               # 15 Mongoose data schemas
│   ├── routes/               # Express routing modules (17 route files)
│   ├── services/             # Queue prediction algorithm, duration recalculation
│   ├── utils/                # Nodemailer email services, Android SMS Gateway, notifications
│   ├── uploads/              # Local file store for instruction documents, media, & reports
│   └── index.js              # Server entrypoint, HTTP + Socket.io server, auto-release cron
│
├── frontend/                 # Web application (Patient portal, Admin, Receptionist, Nurse, Lab)
│   ├── src/
│   │   ├── app/              # Next.js 15 App Router pages
│   │   │   ├── admin/        # Admin, Receptionist, Nurse, Lab dashboards & management
│   │   │   ├── patient/      # Public tokenized post-op/pre-op instruction viewers
│   │   │   └── page.tsx      # Root Gatekeeper redirecting based on JWT session role
│   │   ├── components/       # UI components (Sidebar, InvoiceTemplate, Dialogs, etc.)
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Admin session helpers, API resolution, formatting utils
│   └── next.config.ts        # Next.js configuration
│
└── care101_app/              # Cross-platform Mobile App (Expo SDK 55 / React Native 0.83)
    ├── app/                  # File-based Expo Router screens
    │   ├── dashboard/        # Doctor app screens (Queue, Patients, Surgeries, Finance, etc.)
    │   ├── patient-dashboard/# Patient app screens (Appointments, Records, Billing, Profile)
    │   ├── signup/           # Multi-step onboarding flows for Doctors and Patients
    │   └── login.tsx         # Unified authentication screen (SLMC or Patient ID)
    ├── components/           # Mobile UI components, BottomNavBars, AI Floating Widget
    ├── context/              # React Context providers (AuthContext, ChatContext)
    ├── services/             # Centralized Axios instance with SecureStore token interceptor
    └── tailwind.config.js    # NativeWind styling configuration
```

---

## 3. Technology Stack & Key Dependencies

| Layer | Component | Technologies & Packages Used |
|---|---|---|
| **Backend API** | Runtime & Server | Node.js (ES Modules, `"type": "module"`), Express.js v5.1.0 |
| | Database | MongoDB Atlas / Local via Mongoose v9.0.1 |
| | Realtime WebSockets | Socket.io v4.8.3 (Room broadcasting for doctor queues) |
| | Security & Auth | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` (salt 10) |
| | AI / LLM Engine | `openai` SDK pointing to NVIDIA Integrate API (`https://integrate.api.nvidia.com/v1`) |
| | Payment Gateway | Stripe Node SDK v20.1.0 |
| | Communications | Nodemailer v8.0.11, Android SMS Gateway v3.4.0 (`android-sms-gateway`) |
| | File Handling | Multer v2.0.2, PDFKit v0.19.1 |
| **Frontend Web** | Framework | Next.js 15 (App Router), React 19.2.0, TypeScript 5.9 |
| | Styling & UI | Tailwind CSS, Radix UI primitives, Lucide React, Framer Motion |
| | State & Session | SessionStorage + JWT exp validation (`adminSession.ts`) |
| **Mobile App** | Framework | Expo SDK 55, React Native 0.83.6, Expo Router v55.0.16 |
| | Styling | NativeWind v4.2.1 (Tailwind for RN), Moti v0.30.0 (Spring animations) |
| | Device Access | `expo-secure-store`, `expo-image-picker`, `expo-document-picker`, `expo-file-system` |
| | Native Payments | `@stripe/stripe-react-native` v0.63.0 |
| | Realtime | `socket.io-client` v4.8.3 |

---

## 4. User Roles & Authorization Matrix

The system implements 6 distinct user roles across two authentication middleware mechanisms:

| Role | Primary Interface | Login Identifier | Approval Required? | Core Capabilities |
|---|---|---|---|---|
| **`patient`** | Mobile App | `patientId` (e.g., `SHP001`) | No (Auto-active) | Book appointments, view queue & dynamic wait estimates, make Stripe payments, access medical/lab reports, chat with AI bot. |
| **`doctor`** | Mobile App | `slmcReg` (SLMC Reg No) | **Yes** (`isApproved: true`) | Manage schedule requests, view assigned patients, examine medical history, add surgery records, generate lab orders, track channeling income. |
| **`system_admin`** | Web Portal | Email address | Pre-seeded / Direct | Full control: create staff, approve doctors, oversee all appointments, adjust hospital bed statuses, access complete financial records. |
| **`receptionist`** | Web Portal | Email address | Admin Created | Check in arrived patients, manage walk-in queues, record doctor arrival, issue bills, collect cash payments. |
| **`nurse`** | Web Portal | Email address | Admin Created | Operate queue management station: call next token number, start/end channeling sessions, record consultation durations for the ML engine. |
| **`lab_assistant`** | Web Portal | Email address | Admin Created | View doctor-submitted lab test requests, upload completed report files (PDF/images), assign test charges. |

### Authentication Middleware Mechanics
1. **Bearer Token (`backend/middleware/auth.js`)**:
   Used for Mobile App and patient/doctor endpoints. Expects header:  
   `Authorization: Bearer <jwt_token>`
2. **Custom Header Token (`backend/middleware/authRole.js`)**:
   Used for Administrative Web Portal endpoints. Expects header:  
   `x-auth-token: <jwt_token>`  
   Employs `authorize(['role1', 'role2'])` for route-level role restriction.

---

## 5. Complete Database Schema (Mongoose Models)

All models are defined in `backend/models/`:

### 5.1 `Patient.js` (`patients` collection)
- `patientId`: String, required, unique. Auto-generated via `pre("validate")` hook formatted as `SHP001`, `SHP002`, etc.
- `fullName`: String, required.
- `username`: String (defaults to `patientId`).
- `email`: String, lowercase, trim.
- `nicNumber`: String, trim (Sri Lankan National Identity Card).
- `password`: String, bcrypt hashed.
- `mobileNumber`: String, required (normalized to E.164 `+94...` in SMS service).
- `dateOfBirth`: Date, required.
- `gender`: String, enum: `["Male", "Female", "Other"]`.
- `district`: String, required.
- `emergencyContact`, `medicalConditions`, `allergies`, `insuranceProvider`, `policyNumber`, `profileImage`: String defaults to `""`.
- `isRegistered`: Boolean (default `true`).
- `role`: String (default `"patient"`).
- `createdAt`: Date.
- `resetPasswordOtp`: String, `resetPasswordExpire`: Date.

### 5.2 `Doctor.js` (`doctors` collection)
- `name`: String, required.
- `fullName`: String.
- `nameWithInitials`: String.
- `hospital`: String, default `"SUWASEWANA HOSPITAL"`.
- `email`: String, required, unique.
- `password`: String, bcrypt hashed.
- `isApproved`: Boolean, default `false`. **Doctors cannot log in until approved by an admin.**
- `specialization`: String, default `"General Practitioner"`.
- `nic`: String.
- `phone`: String.
- `slmcReg`: String, unique (Sri Lanka Medical Council registration number).
- `profileImage`: String (URL or base64).
- **Receptionist Daily Status:**
  - `isArrived`: Boolean, default `false`.
  - `lastArrivalDate`: Date.
  - `allocatedRoom`: String (e.g. `"Room 04"`).
  - `allocatedNurse`: String (e.g. `"Nurse Perera"`).
  - `channelingTime`: String (e.g. `"04:30 PM"`).
  - `channelingStatus`: String, default `"On Time"` (options: `"On Time"`, `"Delayed 15m"`, `"Delayed 30m"`, `"Delayed 1h"`, etc.).
- **Nurse & Session Tracking:**
  - `sessionStarted`: Boolean, default `false`.
  - `sessionEndedToday`: Boolean, default `false`.
  - `currentQueueNumber`: Number, default `0`.
  - `averageConsultationDuration`: Number (minutes), default `10`.
- `resetPasswordOtp`: String, `resetPasswordExpire`: Date.

### 5.3 `Admin.js` (`admins` collection)
- `name`: String, required.
- `email`: String, required, unique.
- `password`: String, hashed.
- `role`: String, enum: `["system_admin", "receptionist", "nurse", "lab_assistant"]`, default `"receptionist"`.
- `department`: String, default `"General"`.
- `resetPasswordToken`: String, `resetPasswordExpire`: Date.

### 5.4 `Appointment.js` (`appointments` collection)
- `patientId`: ObjectId ref `Patient`, required.
- `doctorId`: ObjectId ref `Doctor`, required.
- `doctorName`: String, required.
- `department`: String, required.
- `date`: Date, required.
- `visitType`: String, default `'Channeling'`.
- `reason`: String.
- `queueNumber`: Number.
- `status`: String, enum: `["pending", "confirmed", "scheduled", "completed", "cancelled"]`, default `"pending"`.
- `amount`: Number, default `0`.
- `paymentStatus`: String, enum: `["pending", "paid", "failed"]`, default `"pending"`.
- `arrived`: Boolean, default `false` (marked when patient checks in at reception).
- Indexes: `{ patientId: 1, date: -1 }`, `{ doctorId: 1, date: 1, status: 1 }`.

### 5.5 `ScheduleRequest.js` (`schedulerequests` collection)
- `doctorId`: ObjectId ref `Doctor`.
- `doctorName`: String.
- `date`: Date, required.
- `startTime`: Date, required.
- `endTime`: Date, required.
- `isUnlimited`: Boolean, default `false`.
- `queueLimit`: Number.
- `status`: String, enum: `['pending', 'approved', 'rejected']`, default `'pending'`.
- `allocatedRoom`: String.
- `allocatedNurse`: String.
- Index: `{ doctorId: 1, status: 1, date: 1 }`.

### 5.6 `ConsultationHistory.js` (`consultationhistories` collection)
- `doctorId`: ObjectId ref `Doctor`.
- `patientId`: ObjectId ref `Patient`.
- `appointmentId`: ObjectId ref `Appointment`.
- `date`: Date, default `Date.now`.
- `actualDuration`: Number (minutes taken for the consultation).
- `startHour`: Number (0–23).
- `dayOfWeek`: Number (0–6).
- `delayMinutes`: Number (deviation from scheduled slot).

### 5.7 `LabRequest.js` (`labrequests` collection)
- `patientId`: ObjectId ref `Patient`.
- `doctorId`: ObjectId ref `Doctor`.
- `doctorName`: String.
- `title`: String.
- `description`: String.
- `type`: Enum `['lab_tests', 'prescriptions', 'reports', 'consultations']`, default `'lab_tests'`.
- `status`: Enum `['pending', 'completed']`, default `'pending'`.
- `recordId`: ObjectId ref `MedicalRecord`.
- `billId`: ObjectId ref `Bill`.

### 5.8 `MedicalRecord.js` (`medicalrecords` collection)
- `patientId`: ObjectId ref `Patient`.
- `type`: Enum `['consultations', 'prescriptions', 'lab_tests', 'reports']`.
- `title`: String.
- `doctorName`: String, default `"Self Uploaded"`.
- `date`: Date.
- `description`: String.
- `diagnosis`: String.
- `medications`: String.
- `fileData`: String (Base64 data or file URL).
- `fileType`: String (e.g., `"application/pdf"`, `"image/png"`).

### 5.9 `SurgeryRecord.js` (`surgeryrecords` collection)
- `doctorId`: ObjectId ref `Doctor`.
- `name`: String (Patient name).
- `nic`: String.
- `patientId`: String.
- `hospital`: String.
- `surgeryCardImage`: String (Base64).
- `entries`: Array of `{ date: Date, notes: String, images: [String] }`.

### 5.10 `Bill.js` (`bills` collection)
- `patientId`: ObjectId ref `Patient`.
- `title`: String.
- `type`: Enum `['Appointment', 'Pharmacy', 'Surgery', 'Lab']`.
- `amount`: Number.
- `date`: Date.
- `status`: Enum `['Pending', 'Paid']`.
- `appointmentId`: String.

### 5.11 `Finance.js` (`hospitalfinances` collection)
- `doctorId`: ObjectId ref `Doctor`.
- `name`: String (Hospital name).
- `records`: Array of `{ date: Date, patients: Number, income: Number, bht: String, amount: Number, type: ['channeling', 'surgical'] }`.

### 5.12 `HospitalStatus.js` (`hospitalstatuses` collection)
- `generalWard`: String (default `"Available"`).
- `icuBeds`: Number (default `0`).
- `emergencyUnit`: String (default `"Normal"`).
- `pharmacy`: String (default `"Open"`).
- `updatedAt`: Date.

### 5.13 `Notification.js` (`notifications` collection)
- `userId`: ObjectId ref `Patient`.
- `type`: Enum `['appointment', 'cancellation', 'reschedule', 'payment', 'prescription', 'lab_report', 'report', 'message', 'reminder', 'schedule_request', 'arrival', 'doctor_status', 'system']`.
- `title`: String.
- `message`: String.
- `read`: Boolean (default `false`).
- `metadata`: Mixed object.
- `timestamp`: Date.
- Index: `{ userId: 1, read: 1, timestamp: -1 }`.

### 5.14 `Instruction.js` & `InstructionShare.js`
- `Instruction`: Links `doctor`, `surgeryName`, `description`, `preOp` `{ video, audio, document }`, and `postOp` `{ video, audio, document }`.
- `InstructionShare`: Links `instruction` to a secure hex `token`, `section` (`preOp` or `postOp`), and an `expiresAt` Date for secure public tokenized web access.

---

## 6. Core Subsystems & Algorithmic Logic

### 6.1 Real-Time Queue & Predictive Arrival Engine (`backend/services/predictionService.js`)
Rather than displaying static queue numbers, Care101 computes dynamic, highly realistic arrival windows for every queued patient.

1. **Session Inactivity Handling**:
   If `doctor.sessionStarted === false`, the algorithm parses the doctor's scheduled `channelingTime` (e.g., "04:30 PM").
   $$\text{baseTime} = \max(\text{now}, \text{scheduledStartTime})$$
   $$\text{estimatedWaitingMinutes} = \text{patientsAhead} \times \text{averageConsultationDuration}$$

2. **Active Session Elapsed-Time Compensation**:
   When the session is live, the algorithm credits time already spent on the current patient:
   $$\text{elapsedOnCurrent} = \text{now} - \text{consultationStartTime}$$
   $$\text{remainingOnCurrent} = \max(0, \text{averageDuration} - \text{elapsedOnCurrent})$$
   $$\text{estimatedWaitingMinutes} = \text{remainingOnCurrent} + (\text{patientsAhead} - 1) \times \text{averageDuration}$$

3. **Trimmed Mean Duration Recalculation (`updateDoctorAverageDuration`)**:
   To avoid skewed averages caused by abnormal visits (e.g., a 45-minute emergency or a 1-minute prescription pickup), the system collects the doctor's last 50 visits from `ConsultationHistory`, discards the top 10% and bottom 10% outliers, and recalculates the true arithmetic mean.

4. **Confidence Scoring**:
   - `Refined (Historical)`: If `historyCount > 15`.
   - `Calculated`: Standard baseline.
   - `Low (Doctor Not Arrived)`: If `doctor.isArrived === false`.

5. **Socket.io Synchronization**:
   Whenever a nurse advances or completes a token in `/api/queue/update`, the server broadcasts:
   - `doctorStatusUpdated` to all clients.
   - `queueUpdated` specifically to the room `doctor:${doctorId}` containing `{ currentServingNumber, patientQueueNumber, estimatedWaitingMinutes, estimatedArrivalTime }`.

---

### 6.2 Automatic Room and Nurse Deallocation Job
In `backend/index.js`, an autonomous background cron executes every 30 seconds (`setInterval`):
1. Scans `Doctor` collection for records where `allocatedRoom` or `allocatedNurse` is active.
2. Cross-references `ScheduleRequest` to find if their approved channeling session has ended (`endTime <= now`).
3. Verifies if any back-to-back approved session exists right now.
4. If no session is ongoing, it clears `allocatedRoom = ""` and `allocatedNurse = ""` to free the physical facility and staff for other doctors.

---

### 6.3 AI Virtual Assistant Engine (`backend/controllers/chatController.js`)
The hospital's patient assistant utilizes NVIDIA's inference API (`https://integrate.api.nvidia.com/v1`) with resilient multi-model failover:
- Primary candidates: `meta/llama-3.2-11b-vision-instruct`, fallback: `nvidia/nemotron-3-super-120b-a12b`.

**Key Safeguards & Optimizations:**
1. **0ms Regex Guardrails (`isClearOutOfScope`)**: Fast deterministic rejection of queries concerning coding/software, pure math, creative fiction, jokes, trivia, or recipes before reaching the LLM, saving token costs and latency.
2. **Emergency Protocol Guard (`isLifeThreateningEmergency`)**: Instantly detects indicators of cardiac arrest, respiratory failure, severe trauma, stroke, or poisoning, immediately instructing the patient to dial the Sri Lanka National Emergency Ambulance Service (`1990`).
3. **60-Second In-Memory Dynamic Cache**: Injects fresh database snapshots of all registered doctor specialties and the next 7 days of approved channeling sessions into the LLM system prompt without incurring database query overhead on every conversation turn.

---

### 6.4 Communications & Notification System (`backend/utils/emailService.js`)
Care101 operates a dual-channel alerting infrastructure:
1. **Email (Nodemailer)**: Sends branded HTML transactional emails for appointment bookings, doctor onboarding approvals, registration welcomes, and password resets.
2. **SMS Gateway (Android SMS Gateway)**: Connects to local Android SMS gateway hardware to dispatch real-time SMS messages formatted for Sri Lanka (+94) when doctors arrive at the hospital, when clinics are delayed, or when lab results are ready.

---

## 7. REST API Endpoints Catalog

### Authentication & Profiles (`/api/auth`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register-doctor` | Public | Submits new doctor application (creates with `isApproved: false`). |
| `POST` | `/api/auth/register-doctors-bulk` | Public | Bulk seed doctors with default credentials. |
| `POST` | `/api/auth/register-patient` | Public | Patient registration; triggers auto-generation of `SHPxxx` ID and welcome email. |
| `POST` | `/api/auth/login` | Public | Unified login accepting SLMC number (Doctor) or Patient ID (Patient). |
| `POST` | `/api/auth/forgot-password` | Public | Dispatches OTP to registered email. |
| `POST` | `/api/auth/verify-otp` | Public | Validates entered 6-digit OTP code. |
| `POST` | `/api/auth/reset-password` | Public | Overwrites password with new bcrypt hash. |
| `GET`  | `/api/auth/next-patient-id` | Public | Returns the next anticipated `SHPxxx` identifier. |
| `GET`  | `/api/auth/me` | Bearer | Returns the authenticated patient's profile without password. |
| `PUT`  | `/api/auth/update-profile` | Bearer | Updates profile fields. |
| `PUT`  | `/api/auth/change-password` | Bearer | Changes user password. |
| `GET`  | `/api/auth/notifications` | Bearer | Returns in-app notifications for patient. |

### Appointments (`/api/appointments`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/appointments/check-booking` | Bearer | Checks doctor availability for given date/time slot. |
| `POST` | `/api/appointments/book` | Bearer | Books new appointment, assigns next sequential queue number, creates pending bill. |
| `GET`  | `/api/appointments/my-appointments` | Bearer | Retrieves patient's historical and upcoming bookings. |
| `GET`  | `/api/appointments/upcoming` | Bearer | Returns patient's next confirmed appointment. |
| `GET`  | `/api/appointments/queue-status/:id` | Bearer | Calculates live queue state and prediction for appointment. |
| `PUT`  | `/api/appointments/cancel/:id` | Bearer | Cancels appointment and adjusts queue stats. |

### Queue Operations (`/api/queue`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/queue/update` | Bearer | Actions: `"start"`, `"end"`, `"increment"`, `"decrement"`, `"complete"`. Updates current queue, creates `ConsultationHistory`, and emits socket events. |
| `GET`  | `/api/queue/patient/:patientId` | Bearer | Returns live waiting time & arrival prediction for patient. |
| `GET`  | `/api/queue/doctor/:doctorId/live` | Bearer | Returns live doctor queue state and active appointment counts. |

### Doctor Channeling & Dashboard (`/api/doctor` & `/api/doctors`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET`  | `/api/doctors/public` | Public | Public doctor directory with names, specialties, and pictures. |
| `GET`  | `/api/doctors/list` | Bearer | List of approved doctors for internal scheduling. |
| `GET`  | `/api/doctors/search/by-name` | Bearer | Searches doctor by partial name regex. |
| `GET`  | `/api/doctors/:id` | Public | Retrieves specific doctor profile. |
| `GET`  | `/api/doctor/dashboard-stats` | Bearer | Aggregates income, today's appointments, queue number, and assigned room. |
| `PUT`  | `/api/doctor/delay-status` | Bearer | Updates channeling status (e.g. `"Delayed 20m"`) and alerts patients via SMS/Notifications. |
| `PUT`  | `/api/doctor/arrival-status` | Bearer | Marks doctor as arrived (`isArrived: true`) and triggers clinic start alerts. |

### Schedule Requests (`/api/schedule-requests`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/schedule-requests/request` | Bearer | Doctor requests channeling time slot. |
| `GET`  | `/api/schedule-requests/pending` | Bearer | Admin list of pending doctor schedules. |
| `GET`  | `/api/schedule-requests/my-requests` | Bearer | Doctor views own requests. |
| `GET`  | `/api/schedule-requests/doctor/:doctorId/approved` | Bearer | Approved upcoming sessions for a doctor. |
| `GET`  | `/api/schedule-requests/approved/today` | Bearer | Today's active sessions across the hospital. |
| `PUT`  | `/api/schedule-requests/:id/status` | Bearer | Admin approves/rejects schedule request. |
| `PUT`  | `/api/schedule-requests/:id/allocate` | Bearer | Admin/Receptionist allocates room and nurse to approved schedule. |

### Lab Requests & Medical Records (`/api/lab-requests` & `/api/medical-records`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/lab-requests/create` | Bearer | Doctor orders lab test for a patient. |
| `GET`  | `/api/lab-requests/all` | Bearer | Lab assistant views queue of pending test orders. |
| `GET`  | `/api/lab-requests/patient/:patientId`| Bearer | Retrieves lab requests for a specific patient. |
| `POST` | `/api/lab-requests/upload/:requestId` | Bearer | Lab assistant uploads finished report (PDF/image), marks completed, generates bill. |
| `PUT`  | `/api/lab-requests/update-price/:requestId` | Bearer | Sets pricing for test. |
| `POST` | `/api/medical-records/upload` | Bearer | Uploads medical record / report. |
| `GET`  | `/api/medical-records/my-records` | Bearer | Patient accesses their records. |
| `GET`  | `/api/medical-records/patient/:patientId` | Bearer | Doctor accesses specific patient records. |

### Surgery Records & Instructions (`/api/surgery-records` & `/api/instructions`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET`  | `/api/surgery-records` | Bearer | Doctor retrieves surgery records list. |
| `POST` | `/api/surgery-records/create` | Bearer | Doctor creates new surgery record with card image. |
| `POST` | `/api/surgery-records/:id/entry` | Bearer | Adds clinical progress note and entry images to surgery. |
| `GET`  | `/api/surgery-records/patient/my-records`| Bearer | Patient views their surgery timeline. |
| `POST` | `/api/instructions` | Bearer | Doctor creates surgical instruction package. |
| `PUT`  | `/api/instructions/:id/:section/:type` | Bearer | Uploads media file (video/audio/document) for pre-op or post-op. |
| `POST` | `/api/instructions/:id/share` | Bearer | Creates temporary tokenized access link for patient. |
| `GET`  | `/api/instructions/share/:token` | Public | Public patient view of surgery instructions via token. |

### Payments & Billing (`/api/payments`)
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET`  | `/api/payments/my-bills` | Bearer | Patient retrieves active unpaid and paid bills. |
| `POST` | `/api/payments/create-intent` | Bearer | Generates Stripe PaymentIntent `clientSecret` for mobile/web checkout. |
| `PUT`  | `/api/payments/pay-bill/:billId` | Bearer | Marks bill as paid following Stripe confirmation. |

### Administrative Portal Operations (`/api/admin`)
*(Protected by `x-auth-token` and `authorize([...])`)*
| Method | Endpoint | Roles | Purpose |
|---|---|---|---|
| `POST` | `/api/admin/login` | Public | Authenticates administrative staff member. |
| `GET`  | `/api/admin/stats` | Any Staff | Aggregates daily revenue, active doctor count, queue count, and hospital occupancy. |
| `PUT`  | `/api/admin/status` | `system_admin` | Updates ICU bed availability, general ward status, and ER load. |
| `POST` | `/api/admin/appointments/walkin` | Staff | Direct creation of walk-in appointments for arriving patients. |
| `GET`  | `/api/admin/bills/all` | Admin / Reception | Master view of all hospital billing. |
| `POST` | `/api/admin/bills/create` | Admin / Reception | Creates custom bill for pharmacy, surgical fees, or consultation. |
| `PUT`  | `/api/admin/bills/pay/:billId` | Admin / Reception | Records in-person cash settlement of a bill. |
| `POST` | `/api/admin/create-staff` | `system_admin` | Creates new Receptionist, Nurse, or Lab Assistant user. |
| `GET`  | `/api/admin/staff` | `system_admin` | Lists all administrative users. |
| `PUT`  | `/api/admin/all-doctors/:id/approve` | `system_admin` | Formally approves doctor account and sends welcome email. |
| `PUT`  | `/api/admin/doctors/:id/status` | Staff | Manually updates doctor arrival or delay status from reception. |

---

## 8. Web Frontend (Next.js 15) Architecture

- **Session Management (`frontend/src/lib/adminSession.ts`)**:
  Stores `adminToken` and `adminUser` in `sessionStorage` (preventing persistent session leaks across browser restarts). Verifies JWT `exp` timestamp on every navigation.
- **Dynamic Role Landing Routing (`getAdminLandingPath`)**:
  - `receptionist` $\rightarrow$ `/admin/receptionist-dashboard`
  - `lab_assistant` $\rightarrow$ `/admin/lab-assistant-dashboard`
  - `nurse` $\rightarrow$ `/admin/queue`
  - `system_admin` $\rightarrow$ `/admin/dashboard`
- **Key Admin Routes**:
  - `admin/appointments`: Walk-in registration, doctor filter, status manager.
  - `admin/billing`: Bill creation, Stripe status check, and printable invoice generator (`InvoiceTemplate.tsx`).
  - `admin/channeling-time`: Channeling schedule allocation and approvals.
  - `admin/doctors/arrival`: Receptionist tool to clock in doctors and send automated SMS alerts to queued patients.
  - `admin/queue`: Nurse console to step through tokens, measure consultation durations, and invoke the ML predictor.
  - `patient/instructions/[token]`: Public, responsive portal for patients to view surgical videos, audio clips, and PDF guidelines without creating an account.

---

## 9. Mobile Application (Expo / React Native) Architecture

- **Auth Engine (`care101_app/context/auth.tsx`)**:
  Stores JWT and user JSON securely using `expo-secure-store`. Routes users on boot based on `user.role` (`/patient-dashboard` vs `/dashboard`).
- **Doctor Mobile Portal (`care101_app/app/dashboard/*`)**:
  - `appointment/`: Daily appointments, check-in flags.
  - `patients/`: Search hospital patient database by NIC or Patient ID; view full medical timelines.
  - `records/`: Surgery card manager with multi-image camera uploads.
  - `instructions/`: Create pre-op and post-op media packages, generate share links.
  - `finance.tsx`: Hospital earnings breakdown (channeling fees vs surgical revenue).
- **Patient Mobile Portal (`care101_app/app/patient-dashboard/*`)**:
  - `index.tsx`: Real-time queue widget connected via Socket.io to doctor room; dynamic countdown to arrival time; appointment overview.
  - `appointments.tsx`: Doctor channeling search, slot selector, Stripe payment integration.
  - `billing.tsx`: List outstanding invoices with one-tap native Stripe checkout.
  - `records/`: Access lab test reports uploaded by lab assistants.
  - `surgery-records/`: Access doctor notes and surgery cards.
  - `AiAssistant.tsx`: Spring-animated floating widget (`MotiView`) connected to the backend NVIDIA AI endpoint for triage and doctor search.

---

## 10. Environment Variables Specification

### Backend (`backend/.env`)
```bash
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/care101?retryWrites=true&w=majority
JWT_SECRET=super_secret_jwt_key_here

# AI Service (NVIDIA Integrate API)
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe Payments
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email Service (Nodemailer SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=hospital.notifications@gmail.com
EMAIL_PASS=app_specific_password_here

# SMS Gateway (Android SMS Gateway Integration)
SMS_GATEWAY_LOGIN=admin
SMS_GATEWAY_PASSWORD=gateway_password
SMS_GATEWAY_BASE_URL=http://192.168.1.100:8080
SMS_GATEWAY_SIM_NUMBER=1
```

### Frontend (`frontend/.env`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Mobile App (`care101_app/.env`)
```bash
# Physical device: Use local LAN IP (e.g. http://192.168.1.15:5000/api)
# Android Emulator: http://10.0.2.2:5000/api
# iOS Simulator: http://localhost:5000/api
EXPO_PUBLIC_API_URL=http://192.168.1.15:5000/api
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 11. Crucial Implementation Gotchas & Conventions for AI Agents

When developing or modifying code in this repository, always observe these conventions:

1. **Dual Header Token Pattern**:
   - Web Admin endpoints expect `req.header("x-auth-token")`.
   - Mobile/Patient endpoints expect `req.header("Authorization")` in `Bearer <token>` format.
   - Always verify which middleware (`middleware/auth.js` vs `middleware/authRole.js`) guards the target endpoint before modifying request headers.

2. **Case Insensitivity in Enums**:
   Legacy MongoDB records may store appointment statuses with different capitalizations (`"confirmed"`, `"Confirmed"`, `"pending"`, `"Pending"`). Always query using case-tolerant patterns:
   ```javascript
   status: { $in: ["confirmed", "Confirmed", "pending", "Pending"] }
   // or
   status: { $regex: /^confirmed$/i }
   ```

3. **Doctor Login Gate**:
   Doctors cannot log in after registering until an administrator updates `isApproved: true`. If testing doctor authentication, ensure the test record has `isApproved: true` in MongoDB.

4. **Patient Identifier Auto-Increment**:
   Never manually format `patientId` in patient creation routes. Allow the Mongoose `pre("validate")` hook on `PatientSchema` to query the highest existing `SHP\d+` record and assign the sequential ID automatically.

5. **Socket.io Room Subscriptions**:
   When patients or doctors view queue status, the frontend must emit `socket.emit("joinDoctorRoom", doctorId)`. The server emits `queueUpdated` events exclusively to `doctor:${doctorId}` to prevent cross-clinic data leaks.

6. **Sri Lankan Phone Number Handling**:
   The SMS gateway utility (`utils/emailService.js`) expects numbers formatted for Sri Lanka (`+94...`). The function `formatPhoneNumber()` automatically transforms local numbers starting with `0` (e.g., `0771234567` $\rightarrow$ `+94771234567`). Keep this in mind when implementing any new SMS dispatching routines.
