# PulseChat — Full Deployment Guide
## GitHub + Vercel + Firebase + Supabase

---

## Overview

PulseChat is a **static HTML/CSS/JS app** with no build step. It relies on:
- **Firebase** → Authentication & Firestore database
- **Supabase** → Secondary backend (storage/auth)
- **GitHub** → Source control
- **Vercel** → Hosting & deployment

Total time: ~30–45 minutes

---

## PHASE 1 — Set Up Firebase

### Step 1: Create a Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it `pulsechat` (or whatever you prefer)
4. Disable Google Analytics if you don't need it → Click **"Create project"**

### Step 2: Enable Authentication
1. In the Firebase console sidebar → **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, enable **Email/Password** (and any other providers you need)
4. Click **Save**

### Step 3: Create Firestore Database
1. Sidebar → **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → Click **Next**
4. Select a region (e.g. `us-central`) → Click **Enable**

### Step 4: Deploy Firestore Security Rules
The project already includes `firestore.rules` and `firestore.indexes.json`. To deploy them:
1. Install Firebase CLI (if you haven't):
   ```bash
   npm install -g firebase-tools
   ```
2. Log in:
   ```bash
   firebase login
   ```
3. Inside the project folder:
   ```bash
   firebase deploy --only firestore
   ```

### Step 5: Get Your Firebase Config
1. In Firebase console → ⚙️ **Project Settings** (gear icon, top left)
2. Scroll down to **"Your apps"** → Click **"Add app"** → Choose **Web (`</>`)**
3. Register the app (name it anything, skip Firebase Hosting setup)
4. Copy the config object — it looks like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "pulsechat-xxxxx.firebaseapp.com",
     projectId: "pulsechat-xxxxx",
     storageBucket: "pulsechat-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

### Step 6: Paste Config into the Project
Open `public/assets/js/modules/firebase-config.js` and replace the placeholder values:
```js
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

---

## PHASE 2 — Set Up Supabase

### Step 7: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) → **Sign up / Log in**
2. Click **"New project"**
3. Name it `pulsechat`, set a strong database password, choose a region
4. Wait for the project to finish provisioning (~2 min)

### Step 8: Get Your Supabase Credentials
1. In the Supabase dashboard → **Settings (gear icon) → API**
2. Copy:
   - **Project URL** (looks like `https://xyzxyz.supabase.co`)
   - **anon/public key** (the long `eyJ...` string under "Project API keys")

### Step 9: Paste Config into the Project
Open `public/assets/js/modules/supabase-config.js` and replace:
```js
const supabaseUrl = "https://xyzxyz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

---

## PHASE 3 — Push to GitHub

### Step 10: Create a GitHub Repository
1. Go to [https://github.com](https://github.com) → Log in
2. Click **"+"** → **"New repository"**
3. Name it `pulsechat`
4. Set visibility to **Private** (recommended — your config contains API keys)
5. Do **NOT** initialize with README (your project already has files)
6. Click **"Create repository"**

### Step 11: Push Your Code
Open a terminal in your project folder (the folder containing `firebase.json`):
```bash
# Initialize git
git init

# Add all files
git add .

# Make your first commit
git commit -m "Initial commit - PulseChat"

# Connect to your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/pulsechat.git

# Push to GitHub
git branch -M main
git push -u origin main
```

> ⚠️ **Security note:** Your Firebase and Supabase keys will be in the repo. Since this is a frontend app, these are "public" keys by design — they are restricted by Firebase Security Rules and Supabase Row Level Security (RLS). Keep the repo **Private** anyway for good practice.

---

## PHASE 4 — Deploy to Vercel

### Step 12: Import Project into Vercel
1. Go to [https://vercel.com](https://vercel.com) → **Sign up / Log in** (use your GitHub account)
2. Click **"Add New… → Project"**
3. Under **"Import Git Repository"**, find and select your `pulsechat` repo
4. Click **"Import"**

### Step 13: Configure Build Settings
Since PulseChat is a pure static site with **no build step**, configure it as follows:

| Setting | Value |
|---|---|
| **Framework Preset** | Other |
| **Root Directory** | `public` |
| **Build Command** | *(leave empty)* |
| **Output Directory** | *(leave empty / use default)* |
| **Install Command** | *(leave empty)* |

Click **"Deploy"**

### Step 14: Wait for Deployment
Vercel will deploy in ~30 seconds. You'll get a live URL like:
```
https://pulsechat-yourname.vercel.app
```

---

## PHASE 5 — Post-Deployment Setup

### Step 15: Add Your Vercel Domain to Firebase Auth
Firebase blocks auth requests from unknown domains by default.
1. Firebase console → **Authentication → Settings → Authorized domains**
2. Click **"Add domain"**
3. Add your Vercel domain: `pulsechat-yourname.vercel.app`
4. If you add a custom domain later, add that too

### Step 16: Verify Everything Works
Open your Vercel URL and test:
- [ ] Landing page loads correctly
- [ ] Sign up / Sign in works
- [ ] Chat functionality works
- [ ] Profile page loads

---

## PHASE 6 — Custom Domain (Optional)

### Step 17: Add a Custom Domain in Vercel
1. Vercel dashboard → Your project → **Settings → Domains**
2. Enter your domain (e.g. `pulsechat.com`) → Click **Add**
3. Follow the DNS instructions Vercel provides (you'll add records in your domain registrar)
4. Remember to also add the custom domain to **Firebase Authorized domains** (Step 15)

---

## Ongoing Deployments

Every time you push changes to GitHub, Vercel will **automatically redeploy**:
```bash
git add .
git commit -m "Your change description"
git push
```
That's it — Vercel watches your `main` branch and deploys within seconds.

---

## Quick Reference

| Service | URL |
|---|---|
| Firebase Console | https://console.firebase.google.com |
| Supabase Dashboard | https://supabase.com/dashboard |
| GitHub Repo | https://github.com/YOUR_USERNAME/pulsechat |
| Vercel Dashboard | https://vercel.com/dashboard |
| Live App | https://pulsechat-yourname.vercel.app |

---

## Troubleshooting

**App loads but auth doesn't work**
→ Make sure your Vercel domain is added to Firebase Authorized Domains (Step 15)

**Firestore reads/writes fail**
→ Check your Firestore security rules — the default production rules block all reads/writes until you configure them

**"Firebase: Error (auth/invalid-api-key)"**
→ Double-check the values in `firebase-config.js` match your Firebase project exactly

**Vercel shows 404 on page refresh**
→ Add a `vercel.json` file to the root of your project with rewrites:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Then push it to GitHub — Vercel will redeploy automatically.
