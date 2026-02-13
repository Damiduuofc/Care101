# Care101

**Care101** is a comprehensive healthcare platform designed to bridge the gap between patients, doctors, and administration. It features a modern web portal for patients and admins, a dedicated mobile application for doctors (and patients), and a robust backend system to manage data and interactions.

## 📂 Project Structure

The project is organized into three main components:

- **`frontend/`**: The web application built with Next.js, serving as the Patient Portal and Admin Dashboard.
- **`backend/`**: The centralized server-side API managing data, authentication, AI integration, and logic.
- **`care101_app/`**: The cross-platform mobile application built with Expo, primarily for Doctors but includes Patient features.

---

## 🛠️ Tech Stack

### Frontend (Web)
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript / JavaScript
- **Styling**: Tailwind CSS, Radix UI, Lucide React, Framer Motion
- **AI Integration**: Google Genkit AI
- **State Management**: React Hooks / Context

### Backend (API)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Authentication**: JWT, Bcrypt
- **AI/LLM**: NVIDIA_API_KEY
- **Payments**: Stripe
- **File Storage**: Local `uploads/` directory (served statically)

### Mobile App (Doctor & Patient)
- **Framework**: [Expo](https://expo.dev/) (React Native)
- **Language**: TypeScript / JavaScript
- **Styling**: NativeWind (Tailwind for React Native)
- **Routing**: Expo Router
- **Payments**: @stripe/stripe-react-native
- **Storage**: AsyncStorage, Expo Secure Store

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (for the mobile app)
- MongoDB instance (Local or Atlas)

### 1. Backend Setup
The backend is the core of the application. Start it first.

```bash
cd backend
npm install




create a .env file with the following variables:
PORT=5000
MONGO_URI
JWT_SECRET
STRIPE_SECRET_KEY
CLIENT_URL=http://localhost:9002
NVIDIA_API_KEY

npm run dev
```
The server will typically start on `http://localhost:5000`.

### 2. Frontend Setup (Web App)

```bash
cd frontend
npm install

create a .env file with the following variables:
NEXT_PUBLIC_API_URL=http://localhost:5000/api

npm run dev
```
The web app will run on `http://localhost:3000`.

### 3. Mobile App Setup

```bash
cd care101_app

create a .env file with the following variables:
# ipconfig getifaddr en0
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_OPENROUTER_API_KEY
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY

npm install
npx expo start
```
Use the Expo Go app on your phone or an emulator to scan the QR code and run the app.

---

## 📄 Documentation

For detailed instructions on building and deploying the application for production, please refer to the [Build Guide](./BUILD_GUIDE.md).

## 👥 Authors

- **Damiduuofc** - *Initial work*

## 📄 License

This project is licensed under the ISC License.
