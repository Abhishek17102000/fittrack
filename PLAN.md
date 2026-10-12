# FitTrack — Detailed Execution Plan

A personal, phone-first app that shows **today's workout** (in gym order, with reps, how-to, video and tips), **levels you up** as you stay consistent, and **tracks diet, protein and supplements** (creatine, vitamin D, B12, omega-3). All data lives on the phone.

---

## 1. Key decisions

| Decision | Choice | Why |
|---|---|---|
| App type | **Progressive Web App (PWA)** | Installs from the browser with "Add to Home Screen" on Android and iPhone. No app store, no Android Studio or Xcode. Works offline. Full screen like a native app. |
| Optional native build | **Capacitor** wrapper → Android APK (Phase 6) | Same code. Use only if you later want an APK file or native notifications. |
| UI framework | **React 18 + TypeScript + Vite** | Fast, well-supported, easy to build into a PWA. |
| Styling | **Tailwind CSS** + **Framer Motion** for animation | Clean look, smooth transitions, dark mode built in. |
| Components | **shadcn/ui** (Radix-based) | Accessible, good-looking building blocks; you own the code. |
| Database | **IndexedDB via Dexie.js** | A real database inside the phone's browser. Indexed queries, schema versions, works offline, no server. |
| Charts | **Recharts** | Progress graphs for weight, protein and volume. |
| Offline / install | **vite-plugin-pwa** (Workbox) | Service worker, offline caching, install prompt. |
| Hosting (one-time) | **GitHub Pages / Netlify / Cloudflare Pages** (free) | A PWA has to be loaded once over HTTPS. After install it runs from the phone's own storage. |
| Backup | Export/import a JSON file | Your data never leaves the phone unless you export it. |

> **Why not React Native or Flutter?** Both need build toolchains and sideloading an APK, and installing on iOS is painful. A PWA meets "easy to deploy on the phone" with the least friction. The data model and code below carry over if you ever switch.

---

## 2. Core user workflow

```
Open app
  └─► Detect timezone + local date/day  (Intl API)
        └─► Apply "day boundary" (default 4:00 AM — a 1:30 AM session still counts for the previous day)
              └─► Look up today's plan for the user's level & week
                    ├─ Gym day   → Today screen: warm-up → exercise 1 … N → finisher → cooldown
                    ├─ Mobility  → stretch routine + walk target
                    └─ Rest day  → steps target + recovery tips
                          └─► Tap "Start Workout" → guided Session Mode
                                └─► Log sets (weight × reps, done ✓) → rest timer → next exercise
                                      └─► Finish → summary, streak update, level progress
```

Diet and supplements are a separate tab, always available.

---

## 3. Features in detail

### 3.1 Date, timezone and schedule engine
- Timezone: `Intl.DateTimeFormat().resolvedOptions().timeZone` (for example `Asia/Kolkata`). Saved in the profile and re-checked on every launch, so travel is handled.
- Local date and weekday come from `date-fns-tz`, never from raw UTC.
- **Day-boundary setting** (default 04:00): you sleep around 2 AM, so anything logged before 4 AM counts toward the previous day.
- Default weekly template (editable in Settings):

| Day | Type | Template |
|---|---|---|
| Mon | Gym | Lower strength |
| Tue | Gym | Upper strength |
| Wed | Gym | Intervals + core |
| Thu | Gym | Full body |
| Fri | Gym | Circuit + core |
| Sat | Mobility | Stretch + long walk |
| Sun | Rest | Steps + recovery |

- **Missed-day handling:** if a gym day is skipped, the next day offers "Do Monday's workout instead?" so the order stays intact.

### 3.2 Today screen
- Header: day name and date, level badge, streak flame, estimated time (about 45 min).
- Ordered exercise cards, from first to last:
  - Exercise name and target muscles
  - Sets × reps (or time), rest time, suggested weight (from last session plus progression)
  - Short thumbnail; tap to expand
- Expanded card:
  - **How to do it:** 3–5 numbered steps
  - **Video:** embedded YouTube player (`youtube-nocookie.com`, starting at a set time)
  - **Tips and tricks:** 2–4 cues ("brace before you descend", "push the floor away")
  - **Common mistakes:** 2–3 items
  - **Easier / harder swap:** the regression or progression variant
- When offline, the video area shows the text steps and a "video available when online" note.

### 3.3 Session mode (in the gym)
- One exercise at a time, full screen, with large tap targets you can use with sweaty hands.
- Each set row: weight stepper, reps stepper, ✓ button. Values are pre-filled from last time.
- **Rest timer** starts automatically on ✓, with a vibration (`navigator.vibrate`) and a sound when it ends.
- **Screen stays awake** during a session (Wake Lock API).
- Swipe to the next or previous exercise; "Skip" and "Swap exercise" options.
- Optional effort rating per exercise (RPE: Easy / Good / Hard), used by the progression engine.
- Finish screen: total time, sets done, volume (kg moved), personal records, streak and level progress bar.

### 3.4 Levels and progression
Four levels: **Beginner → Intermediate → Advanced → Pro.** Each level has its own plan variant: more sets, harder exercise variants, shorter rest, more intervals.

| Level | Volume | Example variants | Rest | Intervals (Wed) |
|---|---|---|---|---|
| Beginner | 3 sets | Goblet squat, knee push-up, assisted pulldown, plank 30 s | 90 s | 5 × 30 s |
| Intermediate | 3–4 sets | Back squat, push-up, lat pulldown, plank 45 s | 75–90 s | 8 × 30 s |
| Advanced | 4 sets | Back squat heavier, weighted push-up, pull-ups, ab rollout | 60–90 s | 10 × 30 s |
| Pro | 4–5 sets | Pause squat, deficit deadlift, weighted pull-ups, hanging leg raise | 60 s | 8 × 45 s |

**Promotion rules** (all must hold over the evaluation window):

| Move | Window | Consistency | Progress | Other |
|---|---|---|---|---|
| Beginner → Intermediate | 4 weeks | ≥ 80% of planned sessions | Weight or reps increased on ≥ 3 main lifts | No "Hard" effort on > 30% of sets in the last week |
| Intermediate → Advanced | 8 weeks | ≥ 80% | ≥ 5 main lifts progressed | Plank ≥ 60 s, 5 unassisted push-ups |
| Advanced → Pro | 12 weeks | ≥ 85% | Bodyweight-relative targets (for example deadlift ≥ 1.25× bodyweight) | Optional self-assessment test day |

- **Promotion is offered, not forced:** a "You've earned Intermediate!" screen with Accept / Stay one more week.
- **Pause protection:** after 14 or more days off, the app suggests a one-week reduced-load "comeback" at the same level (no automatic demotion).
- **Deload week** every 6–8 weeks at 60% load, scheduled automatically.
- **Within-level progression (double progression):** if all sets hit the top of the rep range with an Easy/Good rating, next session suggests +2.5 kg (upper body) or +5 kg (lower body).

### 3.5 Diet and protein
- Daily targets in the profile: **protein 95 g**, calories (optional), water 3 L.
- **Quick-add food library** of Indian vegetarian foods with protein and calories per serving: roti, dal katori, paneer 100 g, soya chunks 50 g, curd, hung curd, besan chilla, sprouts, roasted chana, milk, whey scoop, tofu, rajma, chana, rice katori, makhana and others (about 60 items in the seed data).
- Meals: Breakfast / Lunch / Evening snack / Pre-gym / Dinner. One tap per item, with ½ / 1 / 2 portion buttons.
- Custom foods: add your own with protein and calories.
- **Protein ring** on the home screen; nudge at 8 PM if under 60% of target.
- Optional weight and waist log (weekly) with a trend chart toward the 63 kg goal.

### 3.6 Supplement tracker
Each supplement has a dose, a schedule type and a reminder time:

| Supplement | Default dose | Schedule |
|---|---|---|
| Creatine monohydrate | 3–5 g | Daily (any time) |
| Vitamin D3 | Set by user after blood test (for example 60,000 IU) | Weekly on a chosen day, or every N days |
| Vitamin B12 | 1500 mcg | 3× per week (Mon/Wed/Fri) |
| Omega-3 (algal) | 1 capsule | Daily with a meal |
| Vitamin C | 500 mg | Daily (optional) |
| Whey protein | 30 g | Gym days (pre-workout) |

- A "Due today" checklist on the home screen; one tap to mark taken.
- Adherence calendar (heatmap) and percentage over 30 days.
- Units are checked: mg vs mcg vs IU are labelled explicitly, avoiding the mix-up we discussed earlier.
- Medical note: the vitamin D dose field shows "Set per your blood test / doctor's advice."

### 3.7 Progress and insights
- Streak (consecutive planned days completed; rest days count if steps were logged or the day was ticked).
- Weekly consistency %, total volume, PR list per exercise.
- Charts: body weight, waist, protein per day, main lift progress.
- Level progress card: "Intermediate in 9 more sessions."

### 3.8 Settings
- Profile: name, height, weight, goal weight, vegetarian toggle (filters the food library).
- Weekly template editor (drag exercises, change days).
- Units (kg/lb), day boundary, theme (light/dark/system), reminder times.
- **Export / Import data (JSON)**, and "Reset app".

---

## 4. Data model (Dexie / IndexedDB)

```ts
// db.ts
import Dexie, { Table } from 'dexie';

export interface Profile        { id: 1; name: string; heightCm: number; weightKg: number; goalKg: number;
                                  timezone: string; dayBoundaryHour: number; level: Level; levelSince: string;
                                  proteinTargetG: number; vegetarian: boolean; units: 'kg'|'lb'; }
export type Level = 'beginner'|'intermediate'|'advanced'|'pro';

export interface Exercise       { id: string; name: string; muscles: string[]; equipment: string[];
                                  steps: string[]; tips: string[]; mistakes: string[];
                                  videoId?: string; videoStart?: number;
                                  easierId?: string; harderId?: string; type: 'strength'|'cardio'|'core'|'mobility'; }

export interface WorkoutTemplate{ id: string; name: string; level: Level; dayType: 'gym'|'mobility'|'rest';
                                  blocks: TemplateBlock[]; }          // ordered: warm-up → main → finisher → cooldown
export interface TemplateBlock  { exerciseId: string; sets: number; reps?: [number, number]; seconds?: number;
                                  restSec: number; section: 'warmup'|'main'|'finisher'|'cooldown'; }

export interface WeekSchedule   { weekday: 0|1|2|3|4|5|6; templateKey: string; }   // templateKey resolved per level

export interface Session        { id?: number; date: string /*YYYY-MM-DD local*/; templateId: string;
                                  startedAt: number; finishedAt?: number; status: 'in_progress'|'done'|'skipped'; }
export interface SetLog         { id?: number; sessionId: number; exerciseId: string; setNo: number;
                                  weightKg?: number; reps?: number; seconds?: number; rpe?: 'easy'|'good'|'hard'; done: boolean; }

export interface Food           { id: string; name: string; servingLabel: string; proteinG: number; kcal: number; veg: boolean; custom?: boolean; }
export interface FoodLog        { id?: number; date: string; meal: 'breakfast'|'lunch'|'snack'|'pregym'|'dinner';
                                  foodId: string; portions: number; }

export interface Supplement     { id: string; name: string; dose: number; unit: 'g'|'mg'|'mcg'|'IU'|'capsule';
                                  schedule: { kind: 'daily' } | { kind: 'weekdays'; days: number[] } | { kind: 'everyNDays'; n: number; anchor: string };
                                  reminderTime?: string; active: boolean; }
export interface SupplementLog  { id?: number; date: string; supplementId: string; takenAt: number; }

export interface BodyLog        { id?: number; date: string; weightKg?: number; waistCm?: number; }
export interface LevelEvent     { id?: number; date: string; from: Level; to: Level; reason: string; }

class FitDB extends Dexie {
  profile!: Table<Profile, number>;  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, string>;  schedule!: Table<WeekSchedule, number>;
  sessions!: Table<Session, number>;  sets!: Table<SetLog, number>;
  foods!: Table<Food, string>;  foodLogs!: Table<FoodLog, number>;
  supplements!: Table<Supplement, string>;  supplementLogs!: Table<SupplementLog, number>;
  bodyLogs!: Table<BodyLog, number>;  levelEvents!: Table<LevelEvent, number>;
  constructor() {
    super('fittrack');
    this.version(1).stores({
      profile: 'id', exercises: 'id, type', templates: 'id, level, dayType', schedule: 'weekday',
      sessions: '++id, date, status', sets: '++id, sessionId, exerciseId, [exerciseId+sessionId]',
      foods: 'id, name, veg', foodLogs: '++id, date, [date+meal]',
      supplements: 'id, active', supplementLogs: '++id, date, supplementId, [date+supplementId]',
      bodyLogs: '++id, date', levelEvents: '++id, date',
    });
  }
}
export const db = new FitDB();
```

- **Seed data** (`src/seed/*.json`): ~45 exercises, 4 levels × 7 day templates, ~60 foods, 6 supplements. Loaded on first launch.
- **Storage durability:** call `navigator.storage.persist()` on first run so the browser doesn't evict the data. Remind the user to export a monthly backup.

---

## 5. Screens and navigation

Bottom tab bar (5 tabs, thumb-reachable):

1. **Today**: workout list, Start button, supplements due, protein ring
2. **Diet**: meals for today, quick-add, protein and calories progress
3. **Supps**: due today, adherence calendar, manage supplements
4. **Progress**: streak, level card, charts, PRs, body log
5. **Settings**: profile, schedule editor, reminders, export/import

Full-screen flows: **Onboarding** (4 steps: profile → goal → level self-check → supplements), **Session Mode**, **Exercise Detail**, **Level-Up celebration**.

### UI and "smooth" requirements
- Mobile-first layout at 360–430 px wide; 48 px minimum tap targets; safe-area insets for notched phones.
- Animated page and card transitions (Framer Motion, 150–250 ms); haptic feedback on ✓.
- Dark mode by default (gyms are dim; it also saves battery on OLED screens).
- Target time to interactive under 1.5 s on a mid-range Android phone; route-level code splitting; lazy-load YouTube only when a card is expanded.
- Lighthouse targets: PWA ✓, Performance ≥ 90, Accessibility ≥ 95.

---

## 6. Exercise content and videos

- Each exercise gets: 3–5 steps, 2–4 tips, 2–3 mistakes, an easier/harder link and a YouTube video ID.
- **Video sourcing:** pick from reputable channels with clear form demos (for example certified-coach channels or physiotherapist-led ones). Each video ID is **checked by hand** (it plays, shows correct form, and is short or has a set start time) before it goes into `exercises.json`. Don't auto-generate IDs.
- Embed with `https://www.youtube-nocookie.com/embed/{id}?start={s}&rel=0&modestbranding=1`.
- Optional later step: replace with self-recorded 10-second looping clips (MP4/WebM) cached for offline use.

---

## 7. Reminders and notifications

| Reminder | Trigger |
|---|---|
| Gym reminder | User-set time on gym days |
| Supplements due | Per-supplement reminder time |
| Protein check | 8 PM if < 60% of target |
| Weekly weigh-in | Sunday morning |

- **PWA:** in-app reminders on open, plus Notification API while the app is open. Scheduled background notifications in a pure PWA aren't reliable, especially on iOS.
- **Capacitor build (Phase 6):** `@capacitor/local-notifications` for reliable scheduled reminders. This is the main reason to do the APK build.

---

## 8. Project structure

```
fittrack/
├─ index.html
├─ vite.config.ts            # + vite-plugin-pwa config (manifest, icons, workbox)
├─ public/icons/             # 192, 512, maskable icons
├─ src/
│  ├─ main.tsx, App.tsx      # router + tab layout
│  ├─ db/                    # db.ts, migrations, seed loader, export/import
│  ├─ seed/                  # exercises.json, templates.json, foods.json, supplements.json
│  ├─ engine/
│  │   ├─ dateEngine.ts      # timezone, day boundary, today's weekday
│  │   ├─ scheduleEngine.ts  # resolve template for date + level, missed-day shift
│  │   ├─ progression.ts     # double progression, suggested weight
│  │   ├─ levelEngine.ts     # promotion rules, comeback, deload
│  │   └─ supplementEngine.ts# "due today" from schedule rules
│  ├─ features/
│  │   ├─ today/  session/  exercise/  diet/  supplements/  progress/  settings/  onboarding/
│  ├─ components/ui/         # shadcn components
│  ├─ hooks/                 # useLiveQuery wrappers, useWakeLock, useTimer
│  └─ styles/
└─ tests/                    # vitest unit + playwright e2e
```

---

## 9. Execution phases

| Phase | Scope | Deliverable | Effort |
|---|---|---|---|
| **0. Setup** | Vite + React + TS + Tailwind + shadcn + PWA plugin, lint/format, GitHub repo, CI deploy to GitHub Pages | Empty installable app on your phone | 0.5 day |
| **1. Data and engines** | Dexie schema, seed JSON, `dateEngine`, `scheduleEngine`, `supplementEngine` with unit tests | Correct "today" resolution in any timezone, 4 AM boundary | 1.5 days |
| **2. Today + Exercise detail** | Today screen, ordered cards, detail sheet with steps/tips/video, offline fallback | You can see and follow today's plan | 2 days |
| **3. Session mode** | Set logging, steppers, rest timer, wake lock, vibration, finish summary, PRs | Usable in the gym end to end | 2 days |
| **4. Diet + supplements** | Food library, meal logging, protein ring, supplement schedule/check-off, adherence calendar | Full nutrition and supplement tracking | 2 days |
| **5. Levels + progress** | Progression engine, level rules, level-up screen, deload/comeback, charts, streaks, body log | Gamified consistency loop | 2 days |
| **6. Polish + native (optional)** | Onboarding, animations, dark mode tuning, export/import, Lighthouse fixes; Capacitor APK + local notifications | v1.0 | 2 days |
| **7. Content pass** | Write and check all 45 exercises' steps/tips; verify every video by hand | Trustworthy content | 1–2 days (alongside other phases) |

**Total: about 12–14 focused days** for one developer (or faster with Claude Code building phase by phase).

### Milestone check after each phase
- Phase 1: unit tests show that Monday at 01:30 IST resolves to Sunday, and a timezone change mid-week still gives the right day.
- Phase 3: a full mock workout is logged on a real phone in airplane mode.
- Phase 5: simulated 4 weeks of data triggers the Intermediate promotion offer; 14 days of gap triggers the comeback week.

---

## 10. Testing strategy

- **Unit (Vitest):** date engine (timezones, DST zones like `Europe/London`, day boundary), schedule resolution, supplement "due" rules (weekly / 3× per week / every N days), progression and level rules.
- **Component (Testing Library):** set logging, timer, protein ring totals.
- **E2E (Playwright, mobile viewport):** onboarding → today → session → finish; diet logging; export → reset → import gives the same data.
- **Manual on device:** Android Chrome and iOS Safari. Install, go offline, kill the app, reopen, and check the data is still there.

---

## 11. Deployment: getting it on your phone

**Option A, PWA (recommended, about 10 minutes):**
1. Push the repo to GitHub. A GitHub Action runs `npm run build` and deploys `dist/` to GitHub Pages (free HTTPS).
2. On the phone, open the URL:
   - **Android (Chrome):** menu ⋮ → *Install app*.
   - **iPhone (Safari):** Share → *Add to Home Screen*.
3. Done. The app opens full screen, works offline, and the data stays on the phone. Updates arrive automatically the next time you're online.

**Option B, local network only (no internet hosting):**
- Run `npm run build && npx serve dist` on the laptop and open `http://<laptop-ip>:3000` on the phone over the same Wi-Fi.
- Service workers need HTTPS (except on localhost), so for install and offline use, run it through `mkcert` or a tunnel. Option A is simpler.

**Option C, Android APK (Phase 6):**
- `npx cap add android` → `npx cap sync` → build in Android Studio → install the APK. This adds reliable scheduled notifications.

---

## 12. Privacy, safety and limits

- No account, no server, no analytics; all data in on-device IndexedDB.
- The app is a tracker, not medical advice. Supplement doses, especially vitamin D, carry a "per your doctor / blood test" note.
- Session mode shows a "stop if sharp pain, dizziness or chest discomfort" banner on interval days.
- **Risk:** clearing browser or site data deletes the app's database. This is reduced by `storage.persist()`, monthly backup reminders and one-tap export.

---

## 13. Future ideas (post-v1)
- Step count from Google Fit / Apple Health (needs the Capacitor build and native plugins).
- Barcode scan for packaged foods.
- Optional encrypted cloud backup (for example to your own Google Drive).
- Wear OS / Apple Watch quick-log.
- AI coach: weekly summary and plan tweaks from your logs.
