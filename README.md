# ViralShort 🎬

A full TikTok / Instagram-Reels clone — vertical short-video app with social features,
discovery, real-time messaging, and a complete coins/diamonds economy (gifting,
leaderboard, weekly contests, in-app purchases).

**Stack:** React Native (Expo SDK 54) · Node.js + Express · MySQL (XAMPP) · Socket.IO

---

## ✨ Features

| Area | What's included |
|------|-----------------|
| **Auth & Profiles** | JWT signup/login, profile, edit profile, avatar upload, welcome coins |
| **Video & Feed** | Record/pick video, autoplay preview, filters, soundtracks, upload with progress, vertical swipe feed (For You / Following) |
| **Social** | Like (optimistic), comments + threaded replies, follow/unfollow, notifications |
| **Discovery** | Search (users/videos/hashtags), trending videos, trending hashtags, hashtag pages |
| **Messaging** | Real-time DMs (Socket.IO), conversation list, unread badges, notifications feed |
| **Economy** | Wallet, daily check-in, gifting (coins→diamonds), leaderboard (all-time/weekly), weekly contest with auto-payout, coin/diamond packs (mock checkout) |
| **Polish** | Loading/error/empty states, 401 auto-logout, offline banner, pull-to-refresh, delete video |

---

## 📁 Project structure

```
viralshort/
├── server/   # Node.js + Express REST API + Socket.IO + MySQL
│   ├── src/
│   │   ├── config/        # db, jwt, url helpers
│   │   ├── middleware/     # auth, upload (multer)
│   │   ├── controllers/    # auth, user, video, social, message, wallet, gift, economy
│   │   ├── routes/         # one router per area
│   │   ├── sockets/        # Socket.IO (DMs + realtime notifications)
│   │   ├── jobs/           # weekly contest engine (node-cron)
│   │   ├── app.js / server.js
│   ├── db/schema.sql       # full schema + seed data
│   └── uploads/            # videos, thumbs, avatars
└── app/      # React Native (Expo) mobile app
    └── src/
        ├── api/            # axios client + per-area modules
        ├── context/        # Auth + Socket providers
        ├── navigation/     # tabs + stacks
        ├── screens/        # all screens
        ├── components/      # VideoCard, sheets, grids, state views
        └── theme/          # colors, filters
```

---

## 🛠️ Prerequisites

- **Node.js** 18+ (tested on v22)
- **XAMPP** running **MySQL** (default: user `root`, empty password)
- A phone with **Expo Go** (SDK 54) installed, on the **same Wi-Fi** as your PC

---

## 🚀 Setup & Run

### 1. Database (one time)

Start **MySQL** in XAMPP, then import the schema:

**phpMyAdmin:** http://localhost/phpmyadmin → Import → `server/db/schema.sql` → Go

**or CLI:**
```bash
"C:/xampp/mysql/bin/mysql.exe" -u root < server/db/schema.sql
```

This creates the `viralshort` database with all tables + seed data (gift types, coin packs, sounds).

### 2. Backend

```bash
cd server
npm install        # first time only
npm start          # http://127.0.0.1:4000
```
On boot you should see `[db] Connected to MySQL ✅` and `[contest] Engine started`.

### 3. App

```bash
cd app
npm install        # first time only
npx expo start -c  # -c clears cache; scan the QR with Expo Go
```

> **Phone networking:** the app talks to your PC's **LAN IP**, not `localhost`
> (the phone is a separate device). The IP is set in
> [`app/src/api/config.js`](app/src/api/config.js). If your PC's IP changes,
> run `ipconfig`, find the IPv4 address, and update `LAN_IP`.

---

## 🔌 API overview

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /api/auth/signup` · `POST /api/auth/login` |
| Users | `GET/PATCH /api/users/me` · `POST /api/users/me/avatar` · `GET /api/users/:id` · `POST /api/users/:id/follow` |
| Videos | `POST /api/videos` · `GET /api/videos/feed` · `/following` · `/user/:id` · `/:id` · `POST /:id/like` · `GET/POST /:id/comments` |
| Discover | `GET /api/discover/search` · `/trending` · `/hashtags/trending` · `/hashtag/:name` |
| Messaging | `GET/POST /api/conversations` · `GET/POST /api/conversations/:id/messages` |
| Wallet | `GET /api/wallet` · `/wallet/transactions` · `POST /wallet/daily/claim` |
| Economy | `POST /api/gifts/send` · `GET /api/leaderboard` · `/contest/current` · `GET /api/store/packs` · `POST /api/store/buy` |
| Realtime | Socket.IO: `message:send` / `message:new` / `notification:new` / `typing` |

---

## ⚠️ Notes & limitations (local MVP)

- **Video storage** is the local `server/uploads/` folder (no CDN/cloud).
- **Thumbnails** show a ▶ placeholder — server-side thumbnail generation needs
  **ffmpeg**, left out of the local MVP. Videos play fine.
- **Filters** are color-grade **overlays**; **soundtracks** are metadata labels —
  they don't yet bake audio/effects into the file (needs ffmpeg/native processing).
- **Payments** use a **mock checkout** — swap in Razorpay / Stripe / Google Play
  Billing at `POST /api/store/buy` for real money.
- For production: add HTTPS, rate limiting, cloud storage + transcoding, and
  push notifications (FCM/APNs).

---

## 📦 Build phases (all complete ✅)

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Foundation & setup | ✅ |
| 1 | Authentication & profiles | ✅ |
| 2 | Video upload & swipe feed | ✅ |
| 3 | Social (like / comment / follow) | ✅ |
| 4 | Discovery (search / hashtags / trending) | ✅ |
| 5 | Messaging & notifications | ✅ |
| 6 | Coins / diamonds economy | ✅ |
| 7 | Polish & handoff | ✅ |
