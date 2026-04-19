# 📖 Digital Memory Diary

A beautiful, minimal, and highly interactive personal memory-keeping application. Designed to feel like a real digital scrapbook, this application features a bookshelf interface, smooth 3D page-turning mechanics, and elegant multimedia handling.

## ✨ Features

*   **📚 Bookshelf Interface**: Organize your memories into different books, each representing a unique collection or chapter of your life.
*   **📖 Realistic Page Turning**: Intense 3D page-flip arc mimicking a realistic page turn with dynamic frames, curves, and shadows, powered by Framer Motion.
*   **✍️ Rich Content & Chapters**: Unlimited pages per book. Add text, single images, or "image bundles" that expand smoothly. Read and edit chapter title covers.
*   **🎨 Elegant Design**: Minimalistic journal-like typography, soft shadows, rounded edges, and dark/light mode support. Images feature a decorative "bandage/washi tape" styling.
*   **🎵 Sound Design**: Subtle, soothing sound effects for opening books, flipping pages, and UI interactions (with a global mute toggle).
*   **🔐 Secure & Private**: Google Authentication ensures only you can access your diary. 
*   **📱 Fully Responsive**: Carefully crafted layouts for Mobile, Tablet, and Desktop screens.
*   **🔥 Clean Slate Mode**: Built-in functionality to cleanly wipe all books and securely erase database content to start fresh.

## 🛠️ Tech Stack

*   **Frontend Ecosystem**: React 18, Vite, TypeScript
*   **Styling**: Tailwind CSS
*   **Animations**: Framer Motion
*   **Icons**: Lucide React
*   **Backend & DB**: Firebase (Authentication, Firestore Database)

## 🚀 Getting Started locally

### 1. Clone the repository
```bash
git clone https://github.com/your-username/memory-diary.git
cd memory-diary
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Environment Variables
Copy the example environment file and fill in your Firebase credentials. Your API keys are kept safe and are ignored by git commits.
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your specific Firebase configuration:
```env
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_DATABASE_ID=your-database-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
```

### 4. Run the Development Server
```bash
npm run dev
```

## 🔒 Firebase Configuration Requirements

To run your own instance, ensure your Firebase project has the following configured:
1.  **Authentication**: Google Sign-In Provider enabled.
2.  **Firestore Database**: Initialized with proper rules.
3.  **Security Rules**: Apply the secured zero-trust rules found in the `firestore.rules` file to prevent unauthorized reading/writing.

## ☁️ Deployment to Vercel

This project is fully ready and optimized for seamless deployment on Vercel:

1. Push your code to a GitHub repository.
2. Log into [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
3. Import your GitHub repository.
4. **CRITICAL:** Expand the **Environment Variables** section during setup. You MUST add all of the `VITE_FIREBASE_*` variables from your `.env.local` file into Vercel so the edge servers can securely connect to your database.
5. Click **Deploy**. Vercel will automatically detect the Vite build settings and launch your application!
