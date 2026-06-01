# ClickaClick — Personal Reading Tracker

ClickaClick is a mobile-first web application for tracking your reading life with depth and precision. It goes beyond a simple book list: every session is timed, every stat is calculated, and every reading habit is visualised. Built with a modern React stack and backed by Supabase, it is designed to feel like a native mobile app while running entirely in the browser.

---

## Product Overview

The app is structured around a daily reading workflow. A user discovers a book through the integrated search, adds it to their personal shelf, opens a timed reading session, and watches their statistics grow over time. Social and gamification layers — friends, achievements, unlockable characters, and an annual cinematic recap — provide long-term retention.

---

## Features

### Library
A personal bookshelf supporting three status tiers: *Want to Read*, *Currently Reading*, and *Finished*. Users track their current page, set a custom page count, and assign a star rating. Books are sourced from the Google Books API and stored once in a shared catalogue, minimising duplication across users.

### Reading Session
A distraction-free focus mode with a high-accuracy timer (WakeLock-aware, survives tab switches via `Date.now()` deltas). At session end, the user logs the pages read and optionally writes a note. The session is persisted to Supabase and, if the network fails, recovered from `localStorage` on the next visit. Ambient music is fetched from Jamendo via a Vercel serverless proxy to avoid CORS restrictions.

### Statistics
A full analytics dashboard covering:
- Books finished and total pages read this year
- Hours of active reading time
- True daily average (pages per reading day, timed sessions only)
- Reading pace (pages per hour, derived from timed sessions)
- Year-long reading heatmap (52 × 7 grid, auto-scrolled to the current week)
- Pages per month bar chart with exact labels
- Current and best reading streak
- Goal progress tracking (books/year, pages/day, minutes/day, streak)
- Month-over-month comparison (pages, speed, daily time)

### Manual Page Tracking
When a user updates their current page in the Library outside of a timed session, a `reading_session` row is inserted with `is_manual: true` and `duration_seconds: null`. This ensures total pages are counted in the stats dashboard while excluding the entry from daily averages, reading pace, and streak calculations.

### Search
Book discovery via the Google Books API with genre and author filters. Results are paginated with a sliding window of numbered page buttons.

### AI Recommendations
Google Gemini analyses the user's reading history, genres, and pace to generate personalised book recommendations. Results are cached in Supabase to reduce API calls.

### Achievements
A tiered achievement system (Bronze → Obsidian) with over 30 milestones covering books finished, pages read, genres explored, reading streaks, session count, and notes written. Achievements unlock profile titles and additional characters. Each achievement is rendered with a 3D medal component using Three.js.

### Characters & Avatar
Eight collectible characters (Common to Mythic rarity) rendered in 3D via `@react-three/fiber`. The default characters (Leo and Orion) are available from the start; the rest are locked behind specific achievements. Each character supports multiple colour schemes. The selected character and colour are stored as a JSON blob in the user's profile and appear on the public profile page.

### Year in Review
A full-screen, slide-based annual recap rendered in the style of Spotify Wrapped. Includes:
- Canvas-based animated starfield background
- Canvas-based confetti on the closing slide
- CSS film grain overlay
- Framer Motion scale-and-fade slide transitions
- Animated count-up numbers with gradient text
- Floating genre pills, pulsing glow orbs, cinematic vignette
- Ambient music toggle (loaded via the `/api/music` proxy)
- Shareable screenshot via `html2canvas`

### Friends & Social
Friend request system with follow/accept flow. Any authenticated user can view a friend's public profile, which shows their reading shelf, hours read, books finished, total pages, and unlocked characters. A social feed surfaces recent activity across the friend network.

### Profile
Customisable display name, photo upload (Supabase Storage), avatar character and colour selection, and goal configuration. Earned titles from achievements can be equipped and displayed on the public profile.

### Admin Panel
A protected route (admin flag in the `profiles` table) for managing users and platform content.

---

## Architecture

```
Browser (React SPA)
  └── React Router v7 — client-side routing, all routes rewired via vercel.json
  └── Framer Motion — page transitions and micro-animations
  └── Three.js / @react-three/fiber — 3D character and medal rendering
  └── Recharts — data visualisation
  └── Supabase JS client — auth, database queries, storage uploads

Vercel
  └── Static hosting — Vite production build
  └── Serverless function: /api/music — proxies Jamendo API (avoids CORS)

Supabase
  └── Auth — email/password, session management
  └── PostgreSQL — relational data with Row Level Security on all tables
  └── Storage — user avatar image uploads
```

---

## Database Schema

| Table | Description |
|---|---|
| `profiles` | One row per user. Username, avatar config (JSON), reading goals, admin flag, equipped title. |
| `books` | Shared book catalogue. Populated on first add from Google Books or Open Library. De-duplicated by `google_id`. |
| `user_books` | Per-user shelf entries. Status, current page, rating, custom page count, started/finished timestamps. |
| `reading_sessions` | Individual sessions. Start/end timestamp, duration in seconds, start/end page, pages read, `is_manual` flag. |
| `book_notes` | Reader notes attached to a specific book and optional page number. |
| `friendships` | Directional friend requests with status (`pending` / `accepted`). |

All tables have Row Level Security enabled. Migrations 009–010 add policies allowing authenticated users to read each other's `user_books` and `reading_sessions` (required for public profiles and friend stats).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite 8 |
| Routing | React Router v7 |
| Animations | Framer Motion |
| 3D | Three.js, `@react-three/fiber`, `@react-three/drei` |
| Charts | Recharts |
| Styling | Inline styles with a runtime theme object; Tailwind CSS for utilities |
| Auth / Database / Storage | Supabase (PostgreSQL + Auth + Storage) |
| Hosting | Vercel |
| Serverless | Vercel Functions (TypeScript) — `/api/music.ts` |
| Book data | Google Books API |
| AI | Google Gemini API |
| Music | Jamendo API (CC-licensed tracks, server-side proxied) |
| Screenshot | html2canvas |

---

## Project Structure

```
src/
  pages/
    Auth.tsx                  Splash, sign-up and sign-in screens
    Home.tsx                  Dashboard — currently reading, streak, weekly heatmap
    Search.tsx                Book search with paginated results
    BookDetail.tsx            Book page — synopsis, notes, sessions, library actions
    Session.tsx               Timed reading session with music
    Library.tsx               Personal bookshelf with swipe-to-finish/delete
    Stats.tsx                 Full statistics dashboard
    Profile.tsx               Avatar, goals, account settings
    PublicProfile.tsx         Friend's public reading profile
    Friends.tsx               Friend requests and social activity feed
    AIRecommendations.tsx     Gemini-powered book recommendations
    Achievements.tsx          Achievement and character collection
    YearInReview.tsx          Cinematic annual reading recap
    admin/AdminPanel.tsx      Admin-only management panel

  components/
    UI.tsx                    Shared primitives — TabBar, BookCover, ProgressBar, Spinner
    AvatarCreator.tsx         Bottom-sheet character and colour picker
    AvatarCharacter.tsx       Character definitions and type
    Character3D.tsx           Three.js character renderer
    Medal3D.tsx               Three.js medal renderer
    MedalIcon.tsx             2D medal fallback
    Icons.tsx                 SVG icon set

  context/
    AppContext.tsx             Auth, theme, and desktop-detection context providers

  services/
    books.ts                  Google Books API — search, fetch by ID, subject/author filters
    gemini.ts                 Gemini API — reading personality summary, recommendations

  data/
    achievements.ts           Achievement catalogue, unlock logic, character/title gates

  lib/
    supabase.ts               Supabase client initialisation

  types/
    index.ts                  Shared TypeScript interfaces

api/
  music.ts                    Vercel serverless function — Jamendo music proxy

supabase/
  migrations/                 10 incremental SQL migrations (run in order in Supabase SQL Editor)
```

---

## Local Development

### Prerequisites

- Node.js 18 or later
- A Supabase project (free tier is sufficient)
- Google Cloud Console project with the Books API enabled
- Google AI Studio API key for Gemini

### Setup

```bash
git clone <repo-url>
cd ClickaClick
npm install
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=            # Supabase project URL
VITE_SUPABASE_ANON_KEY=       # Supabase anon public key
SUPABASE_SERVICE_ROLE_KEY=    # Used by serverless functions only (set on Vercel, not locally)
VITE_GOOGLE_BOOKS_API_KEY=    # Google Books API key
VITE_GEMINI_API_KEY=          # Google Gemini API key
VITE_APP_URL=                 # Your Vercel deployment URL
```

Run the Supabase migrations in order (001 → 010) by pasting each file from `supabase/migrations/` into the Supabase SQL Editor.

```bash
npm run dev       # Start dev server — http://localhost:5173
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview the production build locally
npm run lint      # ESLint
```

---

## Deployment

Vercel is configured for automatic deployment on every push to `main`. The `vercel.json` catch-all rewrite ensures React Router handles all navigation client-side.

`api/music.ts` is automatically deployed as a Vercel serverless function and exposed at `/api/music?tag=<genre>`. It proxies requests to the Jamendo API so the browser never makes a cross-origin request directly to Jamendo.

All environment variables must be added in the Vercel dashboard under **Settings → Environment Variables**.
