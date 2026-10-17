/**
 * Small built-in dictionary of common Indian OPD medicines, used to give every
 * medicine a plain-language "what is it used for" even when the model (or the
 * offline fallback) does not provide one.
 *
 * Phase 5 will move this into `src/community-packs/` so contributors can extend it.
 */
export interface MedicinePurposeEntry {
  /** Lower-case brand/generic names matched anywhere in the medicine name. */
  match: string[];
  en: string;
  hi: string;
  precaution?: string;
}

export const MEDICINE_PURPOSES: MedicinePurposeEntry[] = [
  {
    match: ["pantoprazole", "pantop", "pan 40", "omeprazole", "rabeprazole", "esomeprazole"],
    en: "Reduces stomach acid and protects the stomach lining from acidity, reflux and irritation.",
    hi: "पेट में एसिड कम करता है और एसिडिटी, जलन व खट्टी डकार से पेट की परत को सुरक्षित रखता है।",
    precaution: "Take on an empty stomach, about 30 minutes before food.",
  },
  {
    match: ["paracetamol", "dolo", "crocin", "calpol"],
    en: "Brings down fever and relieves headache and body ache.",
    hi: "बुखार उतारता है और सिरदर्द व बदन दर्द से राहत देता है।",
    precaution: "Keep at least a 6-hour gap between doses.",
  },
  {
    match: ["azithromycin", "azee", "azithral"],
    en: "An antibiotic that treats bacterial infections of the throat, chest and ear.",
    hi: "यह एक एंटीबायोटिक है जो गले, छाती और कान के बैक्टीरियल संक्रमण का इलाज करती है।",
    precaution: "Complete the full course even if you feel better.",
  },
  {
    match: ["amoxicillin", "amoxyclav", "augmentin", "clavulan"],
    en: "An antibiotic that treats bacterial infections such as throat, chest and urinary infections.",
    hi: "यह एंटीबायोटिक है जो गले, छाती और मूत्र जैसे बैक्टीरियल संक्रमणों का इलाज करती है।",
    precaution: "Complete the full course even if you feel better.",
  },
  {
    match: ["dextromethorphan", "cough syp", "cough syrup", "cpm"],
    en: "Calms a dry, irritating cough and throat allergy so you can rest comfortably.",
    hi: "सूखी खांसी और गले की खराश को शांत करता है ताकि आराम से नींद आ सके।",
    precaution: "May cause drowsiness; avoid driving after the night dose.",
  },
  {
    match: ["cetirizine", "levocetirizine", "montair", "montelukast", "avil", "allegra", "fexofenadine"],
    en: "Relieves allergy symptoms such as sneezing, runny nose and itching.",
    hi: "छींक, बहती नाक और खुजली जैसी एलर्जी के लक्षणों से राहत देता है।",
    precaution: "May cause mild sleepiness.",
  },
  {
    match: ["domperidone", "domstal", "ondansetron", "ondem", "emeset"],
    en: "Relieves nausea and vomiting and helps food move through the stomach.",
    hi: "जी मिचलाना और उल्टी में राहत देता है और पाचन को ठीक रखता है।",
    precaution: "Take 15–30 minutes before food.",
  },
  {
    match: ["antacid", "digene", "gelusil", "mucaine", "gaviscon"],
    en: "Quickly neutralises stomach acid to ease burning, gas and sour belching.",
    hi: "पेट का एसिड तुरंत कम करके जलन, गैस और खट्टी डकार में राहत देता है।",
    precaution: "Shake the bottle well before use.",
  },
  {
    match: ["ibuprofen", "brufen", "diclofenac", "voveran", "aceclofenac", "naproxen"],
    en: "A painkiller that reduces pain, swelling and inflammation.",
    hi: "दर्द, सूजन और जलन कम करने वाली दर्द की दवा।",
    precaution: "Always take after food to protect the stomach.",
  },
  {
    match: ["metformin", "glycomet"],
    en: "Helps control blood sugar in diabetes.",
    hi: "डायबिटीज़ में ब्लड शुगर को नियंत्रित रखने में मदद करता है।",
    precaution: "Take with or right after meals.",
  },
  {
    match: ["amlodipine", "telmisartan", "losartan", "atenolol", "metoprolol"],
    en: "Lowers high blood pressure and protects the heart.",
    hi: "हाई ब्लड प्रेशर को कम करता है और दिल की सुरक्षा करता है।",
    precaution: "Take at the same time every day; do not stop suddenly.",
  },
  {
    match: ["atorvastatin", "rosuvastatin"],
    en: "Lowers cholesterol to reduce the risk of heart disease and stroke.",
    hi: "कोलेस्ट्रॉल कम करता है ताकि दिल की बीमारी और स्ट्रोक का खतरा घटे।",
    precaution: "Usually taken at night.",
  },
  {
    match: ["ors", "electral", "oral rehydration"],
    en: "Replaces water and salts lost during loose motions, vomiting or fever.",
    hi: "दस्त, उल्टी या बुखार में शरीर से निकले पानी और नमक की कमी पूरी करता है।",
    precaution: "Mix one sachet in clean water as directed.",
  },
  {
    match: ["vitamin", "multivit", "becosule", "b-complex", "b complex", "calcium", "shelcal", "zinc"],
    en: "A supplement that helps with weakness, recovery and daily nutrition needs.",
    hi: "कमज़ोरी दूर करने और स्वास्थ्य लाभ में मदद करने वाला पूरक (सप्लीमेंट)।",
  },
];

export const PURPOSE_UNKNOWN_EN =
  "Purpose not listed yet — please ask your doctor or pharmacist what this medicine is for.";
export const PURPOSE_UNKNOWN_HI =
  "इस दवा का उपयोग अभी उपलब्ध नहीं है — कृपया अपने डॉक्टर या फार्मासिस्ट से पूछें।";

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
