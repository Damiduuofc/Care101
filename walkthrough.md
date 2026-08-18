# Walkthrough: Dynamic, Time-Based Room & Nurse Allocation System & Billing Synchronization

I have successfully updated the Room Allocation system (`http://localhost:9002/admin/room-allocation`), receptionist billing dashboard, and lab assistant panel to ensure payment settlements unlock report uploads, and that both doctors and patients can view the uploaded reports:

---

## Summary of Completed Changes

### 1. Database & Backend Improvements
- **`backend/models/ScheduleRequest.js`**:
  - Formally added `allocatedRoom` and `allocatedNurse` fields so that allocations are stored per schedule/session rather than just globally on the doctor.
- **`backend/routes/scheduleRequests.js`**:
  - Modified the approved schedules endpoint to support optional date queries (e.g. `GET /approved/today?date=YYYY-MM-DD`).
  - Modified the pending requests endpoint to support date queries (`GET /pending?date=YYYY-MM-DD`) and populated full doctor details.
  - Added `.populate('doctorId', 'name specialization profileImage')` to output full doctor information for layout grouping.
  - Implemented the `PUT /:id/allocate` endpoint with a strict overlapping time formula `(StartA < EndB && EndA > StartB)`. This rejects room or nurse double bookings during overlapping intervals.
  - Automatically syncs room/nurse allocations to the `Doctor` live status record if the schedule is today (so queue and paging work flawlessly).
- **`backend/index.js`**:
  - Implemented an automatic background release task running every 30 seconds.
  - It detects ended approved schedules and sets `Doctor.allocatedRoom = ""` and `Doctor.allocatedNurse = ""` automatically, freeing resources without requiring manual receptionist action.
- **`backend/routes/labRequests.js`**:
  - Validates in `POST /upload/:requestId` that the associated bill status is `"Paid"` before allowing lab reports to be uploaded. Directly blocks upload requests with a `400 Bad Request` if the bill is pending.
  - Resolved `ValidationError` on notification creation during lab request uploads by supplying the required `userId` property.
- **`backend/routes/medicalRecords.js`**:
  - Corrected notification recipient for record uploads. Instead of creating a notification for the uploading assistant/doctor (`req.user.id`), the notification is correctly created for the patient (`actualPatientId`).

### 2. Next.js Admin Frontend Updates
- **Room Allocation Dashboard (`/admin/room-allocation`)**:
  - Re-designed the entire page to support three view tabs:
    - **Visual Grid (Timeline View)**: Displays a timeline matrix where rows represent Rooms 1–20 grouped by department. Shows actual custom start and end times side-by-side. Free rooms show an "Available" badge and a **Quick Allocate** action link.
    - **Session List**: Displays approved doctor sessions for the selected date. Receptionists can allocate/free a Room and Nurse for each session.
    - **Request Room View**: Displays approved doctor schedules that are still missing room/nurse allocations. Provides an **Allocate Room & Nurse** button.
  - **Resource Allocation Modal / Dialog**:
    - Triggered by both the header "+ Allocate Room" button, "Quick Allocate" on free rooms, and "Allocate Room & Nurse" on unallocated requests.
    - Features real-time client-side conflict checking that detects and flags room/nurse overlaps before saving.
  - **Dermatology Color Block**: Updated from orange to the primary theme color (cyan).
  - **Outdated Requests filter**: Outdated approved requests whose session end times have already passed are automatically filtered out.
- **Lab Assistant Dashboard (`/admin/lab-assistant-dashboard`)**:
  - **UX Stale State Fix**: Synchronized the `selectedRequest` state dynamically in `fetchRequests()`. Typing a price and clicking **Set Price** updates the right-hand details card, its current price, and status labels immediately without requiring a manual re-click in the sidebar list.
  - **Color Update (Removed Orange)**: Replaced all orange components on the set-price session with the primary cyan/teal design system.
  - **Hide Price Inputs**: Once a price has been set (> 0 LKR), the price input fields and "Set Price" button hide automatically to keep the UI clean.
  - **Upload Block**: Visually disables the upload document button and highlights standard billing states (`Awaiting Patient Payment` or `Price Not Set`) until the bill status changes to `"Paid"`.
- **Receptionist Billing Dashboard (`/admin/billing`)**:
  - **Cash Payment Settler**: Added a **Pay Cash** button next to **Pay Card** for any unpaid bill items in the Billing History table. This allows the receptionist to mark patient walk-in payments (including lab bill invoices) as `"Paid"` instantly in cash, which settles the bill and unlocks document uploading for the lab assistant.

### 3. Patient & Doctor Mobile Apps (View Uploaded Report Photos)
- **Patient App (`patient-dashboard/records.tsx`)**:
  - Patients can click the **Medical Records** section.
  - Newly completed lab requests appear as a record card of type **Lab Test / Report** (🧪 emoji).
  - Clicking **View Form** fetches the record details from `/medical-records/download/:id` and opens a detail modal.
  - The modal automatically detects and displays the base64-encoded lab report photo (attached by the lab assistant) inside a containment image layout.
- **Doctor App (`dashboard/patients/[id].tsx`)**:
  - Doctors can look up a patient, select their **Medical History** tab, and view the patient's uploaded records list.
  - Doctors can click the **Lab Test / Report** record to open the detailed medical records viewer.
  - It fetches the base64 photo via `/medical-records/download/:id` and renders the lab report photo cleanly on screen.

### 4. SMS Gateway Multi-SIM Configuration
- **`backend/.env`**:
  - Changed `SMS_GATEWAY_SIM_NUMBER` from `1` to `2` to route all outgoing confirmation SMS messages through SIM 2 (`0713258923`) instead of SIM 1 (`0763801234`), as per the Android SMS Gateway multi-SIM documentation.
  - Restarted the backend server to load the new SIM configuration.

### 5. Mobile App Bugfixes
- **Stripe Environment Variable Typo Fix**:
  - Corrected the typo in `care101_app/.env` where `EXPO_PUBLIC_STR123IPE_PUBLISHABLE_KEY` was defined instead of `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`. This resolves the payment sheet initialization failures, allowing patients to complete Stripe card payments from their app.
- **Shortcut Link Redirection Bug**:
  - The patient home dashboard "Medical Records" shortcut button and the bottom navigation bar's "Records" tab were pointing to `/patient-dashboard/surgery-records` instead of `/patient-dashboard/records`. Since surgery records are stored separately, patients were unable to view general records, prescriptions, and lab tests. This link has been corrected.
- **Initial Token Load Lifecycle Bug**:
  - The `useEffect` inside `records.tsx` has been updated to depend on the `token` state rather than executing on mount. This ensures the patient records list is successfully fetched once the JWT is resolved from SecureStore.
- **Robust Base64 Image Layout Rendering**:
  - Wrapped image components in both patient and doctor modals inside `<View>` components with fixed dimensions to guarantee proper scaling of the Base64 image payload in React Native.

---

## Verification & Testing Steps

1. **Verify Lab Price Setting (Lab Assistant side)**:
   - Go to `/admin/lab-assistant-dashboard`.
   - Select a pending request in the sidebar.
   - Enter a price (e.g. `1200`) and click **Set Price**.
   - Verify the "Current Price" display updates immediately in the UI to `LKR 1200` and shows `⚠️ Awaiting Patient Payment` (fixing the stale state bug). The **Upload Document** button remains blocked.

2. **Verify Bill Receipt (Receptionist side)**:
   - Go to `/admin/billing`.
   - Look at the Billing History list.
   - Verify the new Lab bill is displayed with the correct description (`Lab Report - [Title]`) and amount `Rs. 1,200`.
   - Click the **Pay Cash** button on the row. Confirm the prompt.
   - Verify the bill's status changes to `"Paid"` immediately in the table.

3. **Verify Upload Unlock (Lab Assistant side)**:
   - Go back to `/admin/lab-assistant-dashboard` and select the same request.
   - Verify the warning is gone and the **Upload Document** button is now unlocked and active.
   - Upload a test photo file and verify submission completes successfully.

4. **Verify Mobile App View (Patient & Doctor)**:
   - Open the patient app, go to **Records**, and tap **View Form** on the new lab report. The uploaded photo will display on screen.
   - Open the doctor app, select the patient, go to **Medical History**, and tap on the record to view the photo.
