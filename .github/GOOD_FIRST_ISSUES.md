# Good First Issues (seeded for Hacktoberfest)

> Maintainers: copy any item below into a GitHub issue and label it `good first issue` + `hacktoberfest` (+ `hacktoberfest-accepted` on merge). Contributors: you can also just open a PR referencing the item number.

Each item is scoped to one PR (<300 lines changed) with clear acceptance criteria.

## Community packs (JSON only — no TypeScript needed)

### 1. Add a diabetes intake complaint template — `hacktoberfest` `good first issue`
Add a `diabetes-followup` complaint to `src/community-packs/intake-templates/common-complaints.json` (id, `labelEn`/`labelHi`, one-tap sample with vitals, 3–4 generic non-diagnostic follow-ups with EN+HI options).
**Acceptance:** `npm run lint && npm run build` pass; the new chip appears in Pre-Visit Bay and fills the form on click (screenshot in PR).

### 2. Add a hypertension intake complaint template — `hacktoberfest` `good first issue`
Same as #1 for high-BP intake (morning headaches, salt intake, medication regularity, home BP readings).
**Acceptance:** same as #1; questions stay non-diagnostic.

### 3. Add 5 medicine explainers — `hacktoberfest` `good first issue`
Append 5 entries to `src/community-packs/medicine-knowledge/medicine-purposes.json` (e.g. levothyroxine, salbutamol inhaler, ranitidine/famotidine, albendazole, ORS variants). Each: `match` fragments, one-line plain `en` + `hi`, practical `precaution`.
**Acceptance:** scan/type each medicine in Post-Visit; both language cards render correctly (screenshots in PR).

### 4. Add a third sample prescription with an SOS edge case — `hacktoberfest`
Add image to `public/samples/` + entry in `src/community-packs/sample-prescriptions/samples.json` where one medicine is `SOS` (as-needed). SOS medicines must create **no** timed calendar events.
**Acceptance:** load the sample → SOS card shows but sync creates zero timed events for it; lint + build pass; image <2 MB, fully synthetic data.

## UI / accessibility

### 5. Empty-state illustrations copy pass — `good first issue`
Review every empty state (no visits, no prescriptions, no calendar events) for friendly, bilingual copy. Fix any English-only strings.
**Acceptance:** no English-only user-facing empty-state strings remain; screenshots of all three states in PR.

### 6. Keyboard navigation through the intake form — `good first issue`
Ensure Tab order, visible focus rings, and Enter-to-submit behave across the Pre-Visit Bay (role toggle, language, vitals, samples, follow-ups).
**Acceptance:** full intake completable keyboard-only in Chrome; no focus traps; note any pre-existing traps found.

### 7. Mobile list → detail flow for completed patients — `enhancement`
The Doctor Console already does list → detail on narrow screens for the waiting queue; extend the same pattern to the completed-patients view.
**Acceptance:** at 360px width, tapping a completed patient opens the brief with a back button; no layout stacking bugs.

## Engine / reliability

### 8. Fallback follow-ups per complaint — `enhancement`
When no Gemma provider is reachable, `previsit-followups` returns generic mock questions. Use `followUpsForComplaint()` from the intake-templates pack to return complaint-aware fallbacks instead.
**Acceptance:** with no API key, typing a fever complaint yields fever-specific follow-ups; works offline; existing tests/manual flow unaffected.

### 9. `.ics` timezone edge cases — `bug`-prone `enhancement`
Verify `.ics` export across `Asia/Kolkata` vs another timezone: event times must stay meal-aligned after import into Google Calendar.
**Acceptance:** document the test (TZ set, file imported, screenshot of correct times) in the PR; fix any drift found.

### 10. Seed-data reset button for presenters — `enhancement`
Add a small "Reset demo data" action (dev-only affordance) that restores the pristine seed without deleting `data/sevasetu.db` by hand.
**Acceptance:** one click restores 2 visits + demo Rx + 2 stale events; never touches real user rows created after seeding (or documents why it can't); guarded so it can't wipe production data silently.
