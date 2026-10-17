# SevaSetu (सेवासेतु) — Bilingual Clinical Bay Intake & Smart Prescription Calendar Bridge

> *Sevā* (compassionate care) + *Setu* (bridge) — a bridge of care between patients, nurses, and doctors.
> **Before the visit**, AI intake at the bay saves the doctor 3–4 minutes per patient. **After the visit**, a prescription scan turns cryptic pills into plain-language guides with an auto-managed Google Calendar schedule.

Built for **Hacktoberfest 2026** · Powered by **Gemma 4** (text, bilingual Hindi/English & prescription vision) · Stack: **Next.js (App Router) + TypeScript + Tailwind CSS + SQLite (`better-sqlite3`) + Web Speech API + Google Calendar API**

**What it is NOT:** not an AI doctor. No diagnosis, no prescription. It only removes generic intake work from doctors and confusion/forgetting from patients.

---

## The two workflows

### 1. Before Your Visit — bilingual bay intake (Patient or Nurse)

- **Dual-mode intake:** speak (voice via Web Speech API, `hi-IN` / `en-IN`) or type symptoms — in Hindi, English, or mixed Hinglish
- **Flexible entry:** patient self-check-in *or* nurse-run waiting area (with vitals: BP, temperature, SpO2, pulse)
- **3–4 smart text follow-up questions** as quick-tap chips (onset, duration, severity, triggers, allergies, existing conditions) — the generic questions the doctor won't have to ask
- **15-second Doctor decision-support brief:** chief complaint + timeline (normalized clinical English, original transcript preserved), vitals + follow-up answers, red-flag triage priority (`Routine` / `Priority` / `Urgent`)
- **Live patient queue** on the Doctor Console — open any brief before the patient walks in, mark patients as seen

### 2. After Your Visit — prescription scan & smart Google Calendar (Patient & Family)

- **Scan the prescription** (photo/upload, JPG/PNG/WEBP) — zero manual typing; manual add/edit as fallback; sample prescriptions included for instant demos
- **Gemma 4 vision extraction:** medicine name & strength, frequency shorthand (`OD`/`BD`/`TDS`/`HS`/`SOS`), food timing (before/after food), duration in days
- **Missing-dosage-days check:** if days are unclear on the scan, an amber prompt blocks calendar sync until the patient confirms the days
- **"What is this medicine used for?" cards** in plain Hindi & English — purpose, when/how to take, duration, key precaution
- **One-tap Google Calendar scheduling** at meal-aligned slots (customizable), with **automatic removal of old prescription events** so there is never confusion or double-dosing
- **`.ics` export + in-app calendar Day/Week/Removed simulator** — works even without a Google login

---

## Quickstart (zero manual migration steps)

```bash
npm install
cp .env.example .env.local   # optional — the app runs fully offline without keys
npm run dev                  # open http://localhost:3000
```

- First run auto-creates `data/sevasetu.db` (SQLite, WAL mode) and seeds demo patients, a prescription, and calendar events.
- Delete `data/sevasetu.db` anytime to reset to the seeded demo state.
- `npm run lint` and `npm run build` must pass before opening a PR.

### Environment variables (all optional)

| Variable | Purpose | Without it |
|---|---|---|
| `DO_MODEL_ACCESS_KEY` | **Phase 6:** Gemma 4 (`gemma-4-31B-it`) via DigitalOcean Gradient™ Serverless Inference | Falls through to the next provider |
| `DO_INFERENCE_MODEL` / `DO_INFERENCE_BASE_URL` | DO inference model / endpoint (defaults shown in `.env.example`) | Defaults are used |
| `DO_GENAI_ENDPOINT` | Optional Gradient Agent endpoint | Skipped |
| `DO_GPU_DROPLET_URL` / `DO_GPU_MODEL` | Optional self-hosted Gemma 4 on a GPU Droplet | Skipped |
| `GOOGLE_API_KEY` | Live Gemma 4 text + vision via Google AI Studio | Built-in resilient demo fallbacks (full flow still works) |
| `GEMMA_MODEL` | Model name (default `gemma-4-26b-a4b-it`) | Default is used |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Local Ollama / OpenAI-compatible endpoint alternative | Skipped |
| `SEVASETU_DB_PATH` | Custom SQLite file path (default `./data/sevasetu.db`) | Default is used |

Provider fallback chain: **DigitalOcean Gradient AI → Google AI Studio → Local Ollama → Resilient Offline Fallback**.

---

## 60-second demo script (golden path)

1. Click **"Load Live Demo Flow"** at the top of the app — it stages a fresh Hindi intake, a Doctor brief, a prescription with a missing-days prompt, and 2 stale calendar events.
2. **Doctor Console** — open the selected Hindi brief (~15 seconds to scan, vitals + triage included).
3. **Post-Visit** — confirm the missing dosage days on the amber prompt (calendar sync stays blocked until then).
4. **Calendar sync** — watch Step 1 remove the 2 stale previous-Rx events, then insert the new meal-aligned schedule; download the `.ics` to prove it works without a Google login.

Backup plan: everything above works with **no internet and no API key** (fallback mode) — rehearse that too.

---

## Architecture

```text
BEFORE YOUR VISIT (Bay / Patient)
[Voice (HI/EN)] or [Text (HI/EN)] + [Optional Bay Vitals]
        │
        ▼
Gemma 4 Intake Engine (/api/gemma/previsit-followups, /api/gemma/previsit-brief)
  1. Normalizes Hindi & English input
  2. Generates 3–4 TEXT-ONLY generic follow-up questions
  3. Compiles the Doctor decision-support brief (SQLite `visits`)
        │
        ▼
AFTER YOUR VISIT (Patient)
[Scan Prescription Image] (or Manual Entry)
        │
        ▼
Gemma 4 Prescription Vision Engine (/api/gemma/parse-prescription)
  1. Extracts meds, dosage, frequency, food timing & duration (days)
  2. Explains "What is this medicine used for?" (EN + HI cards)
  3. Flags missing/unclear days → manual UI prompt (SQLite `prescriptions`)
        │
        ▼
Smart Google Calendar Sync (/api/calendar/sync)
  1. Removes old active `app=sevasetu-rx` events (SQLite `calendar_events`)
  2. Creates new smart recurring medicine events for the confirmed days
```

### Project structure

```text
src/
  app/
    page.tsx                    # server entry: reads SQLite + renders workspace
    api/
      gemma/previsit-followups  # 3–4 text follow-up questions
      gemma/previsit-brief      # 15-second Doctor SOAP brief
      gemma/parse-prescription  # vision extraction + purposes + days check
      calendar/sync             # old-event cleanup + new schedule + .ics
      visits[/[id]]             # queue CRUD + mark-as-seen
      prescriptions[/[id]]       # save / confirm-days / edit medicines
      system/status             # diagnostics drawer payload
      system/demo-flow          # POST: stages the 60-sec golden-path demo
      health                    # readiness probe (SQLite WAL + AI providers)
  components/
    PreVisitBay.tsx             # bay intake (voice/text, HI/EN, validation)
    DoctorConsole.tsx           # live queue + brief + mark-as-seen
    PrescriptionScanner.tsx     # upload / sample Rx / manual entry
    PostVisitWorkspace.tsx      # medicine cards + days gate
    CalendarScheduleCard.tsx    # sync + Day/Week/Removed simulator + .ics
    SevaSetuWorkspace.tsx       # tabs + diagnostics + Load Live Demo Flow
  community-packs/              # ★ open-source contribution surface (JSON + typed loaders)
    intake-templates/           #   common complaints (HI/EN) + follow-up sets
    medicine-knowledge/         #   plain-language medicine purpose dictionary
    sample-prescriptions/       #   anonymized sample Rxs for vision testing
  lib/
    db.ts                       # SQLite schema, auto-seed, all queries
    gemma.ts                    # multi-provider adapter (DO Gradient / Google / Ollama / fallback)
    google-calendar.ts          # live OAuth sync (optional)
    calendar-utils.ts           # meal-aligned slots, event building, .ics
    prescription-utils.ts       # normalization, days validation
    validation.ts               # intake field validation (age, BP, temp, SpO2…)
  prompts/gemma-prompts.json    # tunable prompt templates (no TS edits needed)
  types/sevasetu.ts             # shared TypeScript contracts
public/samples/                 # sample prescription images for instant demos
```

---

## Deploy on DigitalOcean (Phase 6)

- **AI:** DigitalOcean Gradient™ Serverless Inference serves Gemma 4 (`gemma-4-31B-it`, text + prescription vision) — set `DO_MODEL_ACCESS_KEY`; no GPU to manage, pay-per-token only.
- **App:** one-command App Platform deploy from [`.do/app.yaml`](.do/app.yaml) (Bangalore `blr`, cheapest `basic-xxs`), built from the multi-stage [`Dockerfile`](Dockerfile) (Next.js standalone + `better-sqlite3`). Readiness is probed at `/api/health` (SQLite WAL + provider status, no inference spend).
- **Validate for free before spending anything:** `doctl apps spec validate .do/app.yaml` and `docker build -t sevasetu .`
- ⚠️ **Cost caution:** `basic-xxs` is ~$5/month prorated — delete the app (`doctl apps delete <id>`) after demoing on a small balance. App Platform storage is ephemeral, so the SQLite demo DB re-seeds on restart; that's by design for the demo.

---

## Contributing (Hacktoberfest-friendly)

Three contribution tracks need **no TypeScript** — just edit a JSON file:

| Track | File | What to add |
|---|---|---|
| Intake complaint templates | `src/community-packs/intake-templates/common-complaints.json` | New complaint (e.g. diabetes follow-up, pregnancy intake) in EN + HI with 3–4 generic follow-ups |
| Medicine purpose dictionary | `src/community-packs/medicine-knowledge/medicine-purposes.json` | Plain-language `en` + `hi` purpose + precaution for a medicine |
| Sample prescriptions | `src/community-packs/sample-prescriptions/samples.json` (+ image in `public/samples/`) | Anonymized Rx, ideally with a missing-days edge case |

Full guide: **[CONTRIBUTING.md](CONTRIBUTING.md)** — fork → branch → change → `npm run lint && npm run build` → PR in under 15 minutes. Good-first-issue seeds live in [`.github/GOOD_FIRST_ISSUES.md`](.github/GOOD_FIRST_ISSUES.md).

---

## Value at a glance (modeled estimates for a single-doctor OPD)

40 patients/day × 24 days ≈ 960 consultations/month; ~5-min consults, 3–4 min of which is generic questions.

- **Doctor time saved:** 3–4 min/consult → **48–64 hrs/month** (~6–8 working days)
- **Capacity:** reclaimed time at 50% capture → **+290–385 patients/month** (+30–40%), no extra hours
- **Family effort removed:** ~10 min/Rx of typing, alarms, googling drug names → **~300+ hrs/month**
- **Earlier care:** ~5% flagged Priority/Urgent seen ~25 min sooner; 1% fewer avoidable revisits → **~10 freed slots/month**

All figures are pitch assumptions to validate with real pilot data. The reclaimed time is one pool — it either ends the clinic day ~2 hrs earlier or becomes extra patients, never both fully.

---

## Safety & scope

- SevaSetu performs **no diagnosis and prescribes nothing**. Human confirmation gates every AI output: the doctor reviews the brief, the patient confirms missing dosage days.
- Sample data is synthetic and anonymized. If you contribute a prescription sample, **never include real patient names, addresses, phone numbers, or doctor signatures** — see CONTRIBUTING.md.
- Calendar cleanup only touches events tagged `app=sevasetu-rx`; your other calendar events are never deleted.

---

## License

MIT — see [LICENSE](LICENSE). Contributions welcome under the same license.
