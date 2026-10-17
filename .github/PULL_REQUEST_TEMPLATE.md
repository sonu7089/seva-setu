## What does this PR do?

<!-- One workflow, one PR. Link the issue: Fixes #123 -->

## Type of change

<!-- Tick the one that applies -->

- [ ] Community pack addition (JSON only — intake template / medicine explainer / sample prescription)
- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] Docs

## Manual test notes

<!-- What did you click in `npm run dev`? Paste screenshots for UI or pack changes. -->
<!-- For pack additions: which sample chip / medicine card / prescription did you open? -->

-
-

## Checklist

- [ ] Only the files needed for this change are included (no `data/`, `.env.local`, `node_modules`)
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` passes
- [ ] New user-facing strings are bilingual (English + Hindi Devanagari)
- [ ] Synthetic/demo data only — no real patient or doctor personal data
- [ ] Offline fallback still works (tested with no API key) — or N/A (no AI call involved)
