/**
 * SevaSetu Community Packs — open-source contribution modules for Hacktoberfest.
 *
 * - `./intake-templates/` — common OPD complaint templates (Hindi/English)
 *   with one-tap bay scenarios + generic text follow-up questions.
 * - `./medicine-knowledge/` — plain-language "what is this medicine used for"
 *   dictionary (English + Hindi).
 * - `./sample-prescriptions/` — anonymized sample prescriptions for testing
 *   vision extraction and the missing-dosage-days edge case.
 *
 * Each pack is a JSON file (the contribution surface) plus a typed loader.
 * To contribute, edit the JSON and open a PR — no TypeScript needed.
 * See the root CONTRIBUTING.md for the <15-minute guide.
 */
export * from "./intake-templates";
export * from "./medicine-knowledge";
export * from "./sample-prescriptions";
