# Contributing to SevaSetu (सेवासेतु)

Welcome, Hacktoberfest contributor! 🎉 Most contributions need **no TypeScript** — just edit a JSON file. This guide gets your PR up in **under 15 minutes**.

> **License note:** by contributing you agree your work is released under the repo's [MIT License](LICENSE).

---

## 1. Your first PR in under 15 minutes

```bash
# 1. Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/sevasetu.git
cd sevasetu
npm install

# 2. Create a branch (name it after your change)
git checkout -b add-medicine-metformin-purpose
# or: add-intake-diabetes, add-sample-rx-xyz, fix-...

# 3. Make your change (see tracks below — usually ONE json file)

# 4. Verify (must pass with zero errors)
npm run lint
npm run build

# 5. Quick manual check
cp .env.example .env.local   # only if you don't have one; keys optional
npm run dev                   # open http://localhost:3000, exercise your change
rm -f data/sevasetu.db       # optional: restart to confirm fresh-seed still works

# 6. Commit + push + open a PR (fill in the PR template)
git add <your-files>
git commit -m "Add <what> to <pack> (EN+HI)"
git push origin <your-branch>
```

**PR checklist (also in the PR template):**

- [ ] Only the files needed for this change are included (no `data/`, `.env.local`, `node_modules`)
- [ ] `npm run lint` and `npm run build` pass
- [ ] Manual check in `npm run dev` done (note what you clicked in the PR)
- [ ] New strings are bilingual (English + Hindi Devanagari) where the pack requires it
- [ ] No real patient/doctor personal data added (see §5)

A maintainer will review within a few days. Valid PRs get the `hacktoberfest-accepted` label.

---

## 2. Track A — Intake complaint templates (no TypeScript needed)

**File:** `src/community-packs/intake-templates/common-complaints.json`

Add one object to the `complaints` array (copy `fever` and adapt). Schema per complaint:

```json
{
  "id": "migraine",
  "labelEn": "Migraine",
  "labelHi": "माइग्रेन",
  "sample": {
    "name": "Demo Name",
    "age": "30",
    "gender": "Female",
    "vitals": { "bp": "120/80", "temp": "98.6", "pulse": "80", "spo2": "98" },
    "textEn": "One-line English sample complaint.",
    "textHi": "एक पंक्ति में हिंदी नमूना शिकायत।"
  },
  "followUps": [
    {
      "id": "fq-migraine-1",
      "questionEn": "Generic history question (no diagnosis)?",
      "questionHi": "सामान्य प्रश्न (निदान नहीं)?",
      "quickOptionsEn": ["Option 1", "Option 2", "Option 3"],
      "quickOptionsHi": ["विकल्प 1", "विकल्प 2", "विकल्प 3"]
    }
  ]
}
```

**Rules:**

- `id`: lowercase kebab-case, unique across the file. Follow-up ids: `fq-<complaint>-<n>`.
- 3–4 follow-ups per complaint. They must be **generic, non-diagnostic history** (onset, duration, severity, triggers, home medicines, allergies, chronic conditions). **Never** ask for or imply a diagnosis.
- Every English string needs its Hindi Devanagari twin (`questionHi`, 3 `quickOptionsHi`, `textHi`, `labelHi`).
- Vitals use strings: BP `"120/80"`, temp in °F (`"98.6"`), pulse `"80"`, SpO2 `"98"`.
- Good ideas: diabetes follow-up set, pregnancy intake, child fever, post-surgery review, hypertension intake.
- After adding, open the app → Pre-Visit Bay → your complaint appears as a one-tap sample chip. Mention that you clicked it in your PR.

---

## 3. Track B — Medicine purpose dictionary (no TypeScript needed)

**File:** `src/community-packs/medicine-knowledge/medicine-purposes.json`

Append one object to `entries`:

```json
{
  "match": ["levothyroxine", "thyrox", "eltroxin"],
  "en": "Replaces missing thyroid hormone to keep metabolism steady.",
  "hi": "थायरॉइड हार्मोन की कमी पूरी करता है ताकि शरीर की क्रियाएँ संतुलित रहें।",
  "precaution": "Take on an empty stomach, 30–60 minutes before breakfast."
}
```

**Rules:**

- `match`: lowercase brand/generic fragments. Terms ≤4 chars (e.g. `ors`, `cpm`) match as whole words only; longer terms match as substrings — so keep short terms genuinely distinctive.
- `en`: one plain sentence a 12-year-old understands. `hi`: its Devanagari twin (no Roman Hindi).
- `precaution`: optional but preferred — one short practical note (timing, food, full course). Never dosage advice ("take 2 tablets") and never "cures X permanently".
- No diagnosis claims, no "for cancer/heart attack" style scare language.
- After adding, scan/type that medicine in Post-Visit and confirm the card shows your text in both languages.

---

## 4. Track C — Sample prescriptions (no TypeScript needed)

**Files:** `src/community-packs/sample-prescriptions/samples.json` + image in `public/samples/`

1. Add an anonymized prescription image (`JPG`, `PNG`, `WEBP`, or `SVG`, <2 MB) to `public/samples/` — e.g. a clean hand-drawn SVG like the existing `rx-fever-cough.svg`.
2. Append one object to `samples`:

```json
{
  "id": "rx-sample-thyroid",
  "label": "Thyroid",
  "description": "All durations written; tests OD + before-food slots.",
  "imagePath": "/samples/rx-thyroid.svg",
  "patientName": "Demo Patient",
  "doctorName": "Dr. Demo (MBBS)",
  "clinicName": "SevaSetu Community Polyclinic",
  "medications": [
    {
      "name": "Tab Levothyroxine",
      "dosage": "50 mcg",
      "frequencyCode": "OD",
      "foodRelation": "before_food",
      "daysOfDosage": 30
    }
  ]
}
```

**Rules:**

- `id`: `rx-sample-<slug>`, unique. `frequencyCode`: one of `OD BD TDS QID HS SOS`. `foodRelation`: one of `before_food after_food with_food anytime`.
- `daysOfDosage`: a positive number, or `null` **only** when you deliberately want to exercise the missing-days prompt (at least one existing sample already does this — prefer covering a new edge, e.g. `SOS` medicines create no timed events).
- **Privacy is absolute:** synthetic/demo names only. Never real patient names, addresses, phone numbers, or doctor signatures/stamps. Maintainers will reject anything doubtful.
- After adding, load your sample in Post-Visit → confirm extraction cards + calendar slots look right.

---

## 5. Privacy & safety rules (all tracks)

- Synthetic data only. No real prescriptions, no real names, no photos of real people.
- No diagnosis, no dosage recommendations, no "this cures X" claims anywhere.
- Calendar cleanup only touches events tagged `app=sevasetu-rx` — don't change that tag.
- If Gemma output looks wrong in your testing, say so in the PR — human confirmation gates (doctor reviews the brief, patient confirms days) are intentional design, not bugs to remove.

---

## 6. Code contributions (TypeScript/Next.js)

- Read `SPEC.md` (product + technical spec) and `PLAN.md` (phased plan) first — both are tracked in the repo.
- Tunable AI behavior lives in `src/prompts/gemma-prompts.json` — prefer editing prompts over hardcoding strings.
- Keep bilingual UI: every user-facing string needs EN + HI (see `PreVisitBay.tsx` patterns with `font-devanagari`).
- Keep offline-first: every Gemma call must have a fallback path that works with no API key (see `src/lib/gemma.ts`).
- Small PRs win: one issue, one PR, <300 lines changed where possible.

---

## 7. Reporting bugs & asking for features

Use the issue templates (`.github/ISSUE_TEMPLATE/`): **Bug report**, **Feature request**, or **Community pack submission**. Include steps to reproduce, expected vs actual, browser (voice needs Chrome/Edge), and whether you tested with or without `GOOGLE_API_KEY`.

New to the repo? Start with [`.github/GOOD_FIRST_ISSUES.md`](.github/GOOD_FIRST_ISSUES.md) — seeded `good first issue` + `hacktoberfest` tasks with acceptance criteria.

---

## 8. Code of conduct (short version)

Be kind, be patient, assume good intent. Hindi, English, and Hinglish are all welcome. Harassment, spam PRs, or real-patient data uploads will be rejected and reported. Maintainers have the final say on scope and quality — a closed PR is feedback, not a verdict on you. ❤️
