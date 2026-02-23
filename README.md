# PulseChat v2 — Complete Setup & Deployment Guide

> Realtime 1-to-1 messaging with unique usernames, profile photos, blocking, and dark/light mode.

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [File Structure](#2-file-structure)
3. [Firebase Setup (Required for ALL deploy methods)](#3-firebase-setup-required-for-all-deploy-methods)
4. [Deploy to Firebase Hosting](#4-deploy-to-firebase-hosting)
5. [Deploy to Vercel](#5-deploy-to-vercel)
6. [Deploy to Netlify](#6-deploy-to-netlify)
7. [Deploy via GitHub + Auto-Deploy](#7-deploy-via-github--auto-deploy)
8. [Local Development](#8-local-development)
9. [New Features Guide](#9-new-features-guide)
10. [Firestore Data Model](#10-firestore-data-model)
11. [Security Rules](#11-security-rules)
12. [Testing Checklist](#12-testing-checklist)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Project Overview

| Technology     | Used for                                      |
|---------------|-----------------------------------------------|
| HTML/CSS/JS   | Frontend — no frameworks, ES modules          |
| Firebase Auth | Email/Password + Google sign-in               |
| Firestore     | Realtime database, chat, user profiles        |
| Firebase SDK  | Loaded from CDN (no npm needed)               |
| Any host      | Firebase Hosting, Vercel, or Netlify          |

### What's new in v2

- 🏠 **Premium homepage** (`home.html`) with animated hero, features, and CTA
- 🪪 **Unique @usernames** — auto-generated on signup, changeable once/week
- 🔍 **Search by @username or email** (never by display name)
- 🖼️ **Profile photo** — upload from device, stored as compressed image, changeable once/week
- 🔑 **Password change** — requires current password verification
- 🚫 **Block/unblock users** — blocked users cannot send messages
- 🌓 **Dark & light mode** — toggle saved to localStorage

---

## 2. File Structure

```
pulsechat-v2/
├── firebase.json          ← Firebase Hosting + Firestore rules config
├── firestore.rules        ← Security rules (paste into Firebase Console)
├── vercel.json            ← Vercel deployment config
├── netlify.toml           ← Netlify deployment config
├── README.md
└── public/
    ├── home.html          ← Landing page (root /  )
    ├── index.html         ← Login / Register
    ├── app.html           ← Main chat application
    ├── profile.html       ← Profile settings
    ├── 404.html           ← Not found
    ├── _redirects         ← Netlify redirect rules
    └── assets/
        ├── css/
        │   ├── base.css   ← Design tokens (dark + light), resets, components
        │   ├── home.css   ← Landing page styles
        │   ├── auth.css   ← Auth page styles
        │   └── app.css    ← App shell, chat, profile styles
        └── js/
            ├── firebase.js   ← Firebase init — PUT YOUR CONFIG HERE
            ├── theme.js      ← Dark/light theme management
            ├── guard.js      ← Auth route protection
            ├── auth.js       ← Email/password + Google auth
            ├── username.js   ← Username reservation (Firestore transactions)
            ├── users.js      ← User queries, search, block/unblock
            ├── chats.js      ← Chat creation, list, unread counts
            ├── messages.js   ← Send/receive/paginate messages
            ├── ui.js         ← Toasts, modals, skeletons, avatar builder
            └── utils.js      ← Debounce, format, username generator, image resize
```

---

## 3. Firebase Setup (Required for ALL deploy methods)

> ⚠️ **Do this first**, regardless of where you deploy. Firebase powers the backend for all hosting options.

### Step 1 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Enter a project name (e.g. `pulsechat-prod`)
4. Disable Google Analytics (optional) → **Create project**
5. Wait for the project to be created → **Continue**

---

### Step 2 — Enable Authentication

1. In the left sidebar: **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in method** tab:
   - Click **Email/Password** → **Enable** → **Save**
   - Click **Google** → **Enable** → enter your support email → **Save**

---

### Step 3 — Create Firestore Database

1. In the left sidebar: **Build → Firestore Database**
2. Click **Create database**
3. Choose **Production mode** (we'll set rules manually)
4. Pick a region closest to your users (e.g. `us-central`, `europe-west`)
5. Click **Done**

---

### Step 4 — Deploy Firestore Security Rules

1. Go to **Firestore Database → Rules** tab
2. Delete the existing content
3. Copy the entire contents of `firestore.rules` from this project
4. Paste it in → Click **Publish**

---

### Step 5 — Get your Firebase config

1. Click the ⚙️ **gear icon** → **Project settings**
2. Scroll to **Your apps** section → Click **</>** (Web)
3. App nickname: `PulseChat Web` → Click **Register app**
4. Copy the `firebaseConfig` object — it looks like:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId:             "1:1234567890:web:abc123def456"
};
```

5. Open `public/assets/js/firebase.js`
6. Replace the placeholder config with your real config
7. Save the file

---

### Step 6 — Set Authorized Domains

After deploying (step 4, 5, or 6 below), add your domain to Firebase:

1. **Authentication → Settings → Authorized domains**
2. Your deploy URL is added automatically for Firebase Hosting
3. For Vercel: add `your-project.vercel.app`
4. For Netlify: add `your-project.netlify.app`
5. For a custom domain: add it here too

---

## 4. Deploy to Firebase Hosting

Best for: zero-config, tight Firebase integration, free SSL.

### Prerequisites
- Node.js 18+ installed ([nodejs.org](https://nodejs.org))

### On PC (Windows / macOS / Linux)

```bash
# 1. Install Firebase CLI globally
npm install -g firebase-tools

# 2. Login to your Google account
firebase login

# 3. Navigate into the project folder
cd pulsechat-v2

# 4. Initialize Firebase in this project
firebase init

# When prompted:
# ✅ Firestore
# ✅ Hosting
# → Use existing project → select your Firebase project
# → Firestore Rules file: firestore.rules  (press Enter)
# → Firestore indexes file: firestore.indexes.json  (press Enter, auto-creates)
# → Public directory: public  (type "public" and press Enter)
# → Single-page app: N  (type n)
# → Overwrite 404.html: N
# → Overwrite index.html: N

# 5. Deploy everything
firebase deploy

# Your app is live at: https://YOUR-PROJECT-ID.web.app
```

### On Mobile (Android / iOS using Termux or iSH)

**Android — via Termux:**
```bash
pkg update && pkg upgrade
pkg install nodejs
npm install -g firebase-tools
firebase login --no-localhost
# Follow the URL shown, complete auth in browser, paste token back
cd pulsechat-v2
firebase deploy
```

**iOS — via iSH:**
```bash
apk add nodejs npm
npm install -g firebase-tools
firebase login --no-localhost
cd pulsechat-v2
firebase deploy
```

### Deploy only specific parts
```bash
firebase deploy --only hosting          # just the HTML/CSS/JS files
firebase deploy --only firestore:rules  # just security rules
```

---

## 5. Deploy to Vercel

Best for: fast global CDN, generous free tier, automatic GitHub deploys.

### Option A — Vercel CLI (PC)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. In the project folder
cd pulsechat-v2

# 3. Deploy
vercel

# When prompted:
# → Set up and deploy: Y
# → Scope: your account
# → Link to existing project: N
# → Project name: pulsechat (or any name)
# → Directory: ./  (press Enter)
# → Override settings: N

# First deploy creates a preview URL.
# Deploy to production:
vercel --prod
```

### Option B — Vercel Dashboard (PC + Mobile browser)

1. Push your project to GitHub (see [Section 7](#7-deploy-via-github--auto-deploy))
2. Go to [vercel.com](https://vercel.com) → **Sign up / Log in**
3. Click **Add New → Project**
4. Select your GitHub repository
5. **Framework Preset**: Other
6. **Root Directory**: `./` (leave default)
7. **Output Directory**: `public`
8. Click **Deploy**
9. Done! Your app is at `https://your-project.vercel.app`

### Vercel settings needed
- Go to your Vercel project → **Settings → General**
- **Root Directory**: leave empty (uses root `vercel.json`)
- The `vercel.json` in the project handles routing automatically

---

## 6. Deploy to Netlify

Best for: simple drag-and-drop, great free tier, branch deploys.

### Option A — Drag and Drop (easiest, no CLI needed)

1. Go to [app.netlify.com](https://app.netlify.com) → Sign up / Log in
2. From the dashboard, find **"Sites"**
3. Drag the **`public`** folder (not the whole project — just `public/`) onto the Netlify dashboard
4. Your site is live instantly at a random URL like `random-name-123.netlify.app`
5. To rename: **Site settings → Change site name**

### Option B — Netlify CLI (PC)

```bash
# 1. Install
npm install -g netlify-cli

# 2. Login
netlify login

# 3. In project folder
cd pulsechat-v2

# 4. Initialize
netlify init
# → Create & configure a new site
# → Team: your team
# → Site name: pulsechat (or any)

# 5. Deploy to production
netlify deploy --prod --dir=public
```

### Option C — GitHub integration (PC + Mobile browser)

1. Push project to GitHub (see [Section 7](#7-deploy-via-github--auto-deploy))
2. Go to [app.netlify.com](https://app.netlify.com)
3. **Add new site → Import an existing project → GitHub**
4. Authorize Netlify → Select your repository
5. Settings:
   - **Branch**: `main`
   - **Base directory**: leave empty
   - **Build command**: leave empty
   - **Publish directory**: `public`
6. Click **Deploy site**

---

## 7. Deploy via GitHub + Auto-Deploy

Setting this up means every push to `main` automatically re-deploys your app.

### Step 1 — Create GitHub repository

**On PC:**
```bash
# Install Git if you don't have it: https://git-scm.com
cd pulsechat-v2

git init
git add .
git commit -m "Initial commit: PulseChat v2"

# Create a new repo at github.com first, then:
git remote add origin https://github.com/YOUR-USERNAME/pulsechat.git
git branch -M main
git push -u origin main
```

**On Mobile (GitHub mobile app + GitHub.dev):**
1. Open [github.com](https://github.com) in your browser
2. Tap **+** → **New repository** → Name it `pulsechat` → **Create repository**
3. Tap the **Upload files** button
4. Upload all project files (zip works on some devices)
5. Commit the files

### Step 2 — Connect to Vercel or Netlify

**For Vercel auto-deploy:**
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import from GitHub → Select `pulsechat`
3. Configure: Output directory = `public`, Framework = Other
4. Deploy → every `git push` now auto-deploys ✅

**For Netlify auto-deploy:**
1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
2. Connect GitHub → Select `pulsechat`
3. Publish directory = `public`, Build command = (empty)
4. Deploy site → auto-deploys on every push ✅

### ⚠️ Important: Never commit your Firebase config to a public repo

The `firebase.js` file contains your API key. For a public GitHub repo, use Vercel/Netlify **environment variables** instead:

1. In Vercel/Netlify dashboard → **Environment Variables**
2. Add each value:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - etc.
3. Modify `firebase.js` to read from a build-injected config

Alternatively, keep your GitHub repo **private** (free on GitHub) — then your config is safe.

---

## 8. Local Development

```bash
# Option 1: Firebase emulator (best for testing rules)
npm install -g firebase-tools
firebase serve --only hosting
# → Open http://localhost:5000

# Option 2: Simple static server (Node.js)
npx serve public
# → Open http://localhost:3000

# Option 3: Python (built-in, no install)
python3 -m http.server 8000 --directory public
# → Open http://localhost:8000

# Option 4: VS Code Live Server extension
# Install "Live Server" extension → Right-click index.html → "Open with Live Server"
```

> **Note:** For Google sign-in to work locally, add `localhost` to Firebase Auth's authorized domains:
> Firebase Console → Authentication → Settings → Authorized domains → Add `localhost`

---

## 9. New Features Guide

### 🪪 Usernames
- Auto-generated on signup: `janesmith_4829`
- Format: 3–20 chars, lowercase letters, numbers, underscores
- Cannot start/end with underscore
- **Changeable once per week** (7-day cooldown enforced by Firestore transaction)
- Reserved in `usernames/{username}` collection to enforce uniqueness globally

### 🔍 Search
- Search by `@username` (with or without the `@` prefix)
- Search by full email address
- **Never by display name** — users control their discoverability via username
- Tip: Share your `@username` with friends to be found

### 🖼️ Profile photo
- Upload JPG, PNG, WebP, or GIF (max 10MB)
- Automatically resized to 256×256px and compressed
- Stored as a base64 JPEG directly in Firestore (no Storage bucket needed)
- **Changeable once per week** (7-day cooldown)

### 🔑 Password change
- Only available for email/password accounts (hidden for Google accounts)
- Must enter current password to verify ownership before setting new one
- New password must be at least 6 characters and different from the current one

### 🚫 Block/unblock
- Tap the ⊘ icon in the chat header to block a user
- Blocked users see a "cannot send messages" banner
- You can unblock from the chat header or the banner
- Block status is stored in `users/{uid}.blockedUsers[]`

### 🌓 Dark/light mode
- Toggle with the moon/sun icon in the sidebar or profile topbar
- Also available in the homepage navbar
- Preference is saved to `localStorage` and persists across sessions
- Respects `prefers-color-scheme` on first visit

---

## 10. Firestore Data Model

```
users/{uid}
  uid               string
  email             string
  displayName       string
  username          string       ← unique @handle
  photoURL          string|null  ← base64 JPEG data URL
  authProvider      "password" | "google"
  createdAt         Timestamp
  lastSeen          Timestamp
  lastUsernameChange Timestamp   ← for 7-day cooldown
  lastPhotoChange   Timestamp    ← for 7-day cooldown
  blockedUsers      string[]     ← array of blocked UIDs

usernames/{username}
  uid               string       ← owner's UID
  reservedAt        Timestamp

chats/{chatId}              (chatId = [uidA, uidB].sort().join('_'))
  participants      string[]
  participantsMap   { [uid]: true }    ← for Firestore queries
  lastMessageText   string
  lastMessageAt     Timestamp
  lastMessageFrom   string|null
  unreadCount       { [uid]: number }
  typing            { [uid]: boolean }  ← ephemeral

chats/{chatId}/messages/{messageId}
  from              string       ← must equal auth uid
  to                string
  text              string
  createdAt         Timestamp
  type              "text"
```

---

## 11. Security Rules Summary

| Collection         | Read           | Write                    | Notes |
|-------------------|----------------|--------------------------|-------|
| `users`           | Any auth user  | Owner only               | Block array updated by owner only |
| `usernames`       | Any auth user  | Owner only (by uid match)| Enforces uniqueness via transaction |
| `chats`           | Participants   | Participants             | |
| `chats/messages`  | Participants   | Participant + from==uid  | Prevents spoofing |

---

## 12. Testing Checklist

**Authentication**
- [ ] Register with email/password
- [ ] Username auto-generated on register
- [ ] Login with email/password
- [ ] Google sign-in popup (desktop)
- [ ] Google sign-in redirect (mobile)
- [ ] Logged-in user redirected from index.html → app.html
- [ ] Logged-out user redirected from app.html → index.html
- [ ] Logout works

**Username**
- [ ] Username generated automatically on signup
- [ ] Can search by @username
- [ ] Username change works
- [ ] Username change is blocked within 7 days of last change
- [ ] Duplicate username is rejected

**Messaging**
- [ ] Search by email finds user
- [ ] Search by @username finds user
- [ ] Cannot search by display name
- [ ] Chat opens when selecting a search result
- [ ] Messages send in realtime
- [ ] Unread count appears for receiver
- [ ] Unread count clears when opening chat
- [ ] Load more messages works

**Block**
- [ ] Block button appears in chat header
- [ ] Blocking shows banner + disables composer
- [ ] Blocked user cannot send messages
- [ ] Unblock restores messaging
- [ ] Unblock inline button works

**Profile**
- [ ] Display name saves (no limit)
- [ ] Profile photo uploads and appears
- [ ] Photo cooldown message shown if within 7 days
- [ ] Password change: correct old password required
- [ ] Password change fails with wrong old password
- [ ] Password section hidden for Google accounts

**Theme**
- [ ] Dark/light toggle works on homepage
- [ ] Toggle works in app sidebar
- [ ] Toggle works in profile page
- [ ] Theme persists on page refresh
- [ ] No flash of wrong theme on load

---

## 13. Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
Add your hosting domain to **Firebase Console → Authentication → Settings → Authorized domains**.

### Google sign-in popup blocked on mobile
The app automatically falls back to redirect on mobile. If it still fails, check that your domain is authorized.

### Messages not appearing in realtime
Check that your Firestore rules allow reads for authenticated participants. Also verify your Firebase config is correct in `firebase.js`.

### Username search returns no results
Firestore range queries require an index. Go to **Firestore → Indexes → Composite** and create:
- Collection: `users`
- Field 1: `username` → Ascending
- Field 2: `username` → Ascending
(Or click the link in the browser console error — it generates the index automatically.)

### Profile photo not saving
The photo is stored as a base64 data URL in Firestore. Maximum document size in Firestore is 1MB. The app resizes photos to 256×256px JPEG (typically 15–40KB), well within limits. If you hit size errors, reduce the quality in `utils.js` → `resizeImageToDataURL`.

### App not loading after deploy
1. Check that `firebase.js` has your real Firebase config (not the placeholder)
2. Verify Firestore rules are published
3. Check browser console for errors

---

## 💡 Cost

Running on **Firebase free (Spark) plan**:

| Service    | Free limit                              |
|-----------|-----------------------------------------|
| Auth       | Unlimited users                        |
| Firestore  | 50k reads/day, 20k writes/day, 1GB     |
| Hosting    | 10GB storage, 360MB/day transfer       |
| Vercel     | 100GB bandwidth/month (Hobby plan)     |
| Netlify    | 100GB bandwidth/month (Free plan)      |
| GitHub     | Private repos: free (unlimited)        |

For production at scale, upgrade to Firebase Blaze (pay-as-you-go) — typical cost for a small app is $0–$5/month.
