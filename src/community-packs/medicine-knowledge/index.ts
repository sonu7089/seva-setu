/**
 * Community Pack: Medicine Purpose Dictionary (English + Hindi).
 *
 * Source of truth lives in `./medicine-purposes.json` so Hacktoberfest
 * contributors can add a medicine explainer without touching TypeScript —
 * see CONTRIBUTING.md ("Medicine purpose dictionary").
 *
 * This module gives every medicine a plain-language "what is it used for"
 * even when the model (or the offline fallback) does not provide one.
 */
import data from "./medicine-purposes.json";

export interface MedicinePurposeEntry {
  /** Lower-case brand/generic names matched anywhere in the medicine name. */
  match: string[];
  en: string;
  hi: string;
  precaution?: string;
}

export const MEDICINE_PURPOSES: MedicinePurposeEntry[] =
  data.entries as MedicinePurposeEntry[];

export const PURPOSE_UNKNOWN_EN: string = data.unknownFallback.en;
export const PURPOSE_UNKNOWN_HI: string = data.unknownFallback.hi;

export function lookupMedicinePurpose(
  medicineName: string
): MedicinePurposeEntry | null {
  const name = medicineName.toLowerCase();
  return (
    MEDICINE_PURPOSES.find((entry) =>
      entry.match.some((term) => {
        // Short abbreviations (ORS, CPM) must match as whole words.
        if (term.length <= 4) {
          return new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(name);
        }
        return name.includes(term);
      })
    ) ?? null
  );
}
