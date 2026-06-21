# ViralShort

A TikTok / Instagram Reels clone — vertical short-video app with social features,
discovery, messaging, and a coins/diamonds economy (gifting, leaderboard, weekly
contests, in-app purchases).

**Stack:** React Native (Expo) · Node.js + Express · MySQL (XAMPP) · Socket.IO

---

## Project structure

```
viralshort/
├── server/   # Node.js + Express REST API + MySQL
└── app/      # React Native (Expo) mobile app
```

---

## Prerequisites

- **Node.js** 18+ (tested on v22)
- **XAMPP** running **MySQL** (default: user `root`, empty password)
- A phone with the **Expo Go** app installed (Android/iOS), on the **same Wi-Fi** as your PC

---

## 1. Database setup (one time)

1. Start **MySQL** from the XAMPP control panel.
2. Import the schema (either option works):

   **Via phpMyAdmin:** open http://localhost/phpmyadmin → Import → choose
   `server/db/schema.sql` → Go.

   **Via CLI:**
   ```bash
   "C:/xampp/mysql/bin/mysql.exe" -u root < server/db/schema.sql
   ```

This creates the `viralshort` database with all tables and seed data.

---

## 2. Run the backend

```bash
cd server
npm install        # first time only
npm start          # or: npm run dev  (auto-restart on changes)
```

Server runs at `http://127.0.0.1:4000`.
Health check: http://127.0.0.1:4000/api/health

---

## 3. Run the app

```bash
cd app
npm install        # first time only
npm start          # opens Expo dev server + QR code
```

Then **scan the QR code** with the Expo Go app on your phone.

> **Important:** The app talks to the backend over your PC's LAN IP, not
> `localhost` (your phone is a separate device). The detected IP is set in
> [`app/src/api/config.js`](app/src/api/config.js). If your PC's IP changes,
> run `ipconfig`, find the IPv4 address, and update `LAN_IP` there.

On launch you should see **"✅ Connected to ViralShort API"**.

---

## Build progress

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Foundation & setup (API + DB + app round-trip) | ✅ Done |
| 1 | Authentication & profiles | ⏳ Next |
| 2 | Video upload & swipe feed | ⏳ |
| 3 | Social (like / comment / follow) | ⏳ |
| 4 | Discovery (search / hashtags / trending) | ⏳ |
| 5 | Messaging & notifications | ⏳ |
| 6 | Coins / diamonds economy | ⏳ |
| 7 | Polish & handoff | ⏳ |
