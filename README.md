# Care101

**Care101** is a comprehensive healthcare platform designed to bridge the gap between patients and doctors. It features a modern web portal for patients, a dedicated mobile application for doctors, and a robust backend system to manage data and interactions.

## 📂 Project Structure

The project is organized into three main components:

- **`frontend/`**: The patient-facing web application.
- **`backend/`**: The server-side API managing data, authentication, and logic.
- **`care101_doctor_app/`**: The mobile application tailored for doctors.

---

## 🛠️ Tech Stack

### Frontend (Web)
- **Framework**: [Next.js 15](https://nextjs.org/) (App Directory)
- **Language**: TypeScript / JavaScript
- **Styling**: Tailwind CSS, Radix UI, Lucide React
- **AI Integration**: Genkit AI
- **Other**: Firebase, Framer Motion, React 18

### Backend (API)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Authentication**: JWT, Bcrypt
- **AI/LLM**: OpenAI SDK
- **Language**: JavaScript (ES Modules)

### Doctor App (Mobile)
- **Framework**: [Expo](https://expo.dev/) (React Native)
- **Styling**: NativeWind (Tailwind for React Native)
- **Routing**: Expo Router
- **Payments**: Stripe
- **Language**: TypeScript

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (for the mobile app)

### 1. Backend Setup
The backend is the core of the application. Start it first.

```bash
cd backend
npm install
# Create a .env file with your credentials (see BUILD_GUIDE.md for reference)
npm run dev
```
The server will typically start on `http://localhost:5000`.

### 2. Frontend Setup (Patient Web App)

```bash
cd frontend
npm install
# Create a .env file (see BUILD_GUIDE.md for reference)
npm run dev
```
The web app will run on `http://localhost:3000`.

### 3. Doctor App Setup (Mobile)

```bash
cd care101_doctor_app
npm install
npm start
```
Use the Expo Go app on your phone or an emulator to scan the QR code and run the app.

---

## 📄 Documentation

For detailed instructions on building and deploying the application for production, please refer to the [Build Guide](./BUILD_GUIDE.md).

## 👥 Authors

- **Damiduuofc** - *Initial work*

## 📄 License

This project is licensed under the ISC License.
