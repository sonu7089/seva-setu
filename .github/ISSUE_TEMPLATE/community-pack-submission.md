name: Community pack submission
description: Add an intake template, medicine explainer, or sample prescription (JSON only, no TypeScript).
title: "[Pack]: "
labels: ["community-pack", "good first issue"]
body:
  - type: markdown
    attributes:
      value: |
        The fastest contribution: edit ONE json file. See CONTRIBUTING.md tracks A–C.
  - type: dropdown
    id: pack
    attributes:
      label: Which pack?
      options:
        - Intake complaint template (common-complaints.json)
        - Medicine purpose dictionary (medicine-purposes.json)
        - Sample prescription (samples.json + public/samples/ image)
      validations:
        required: true
  - type: input
    id: entry-id
    attributes:
      label: Entry id you are adding
      description: e.g. migraine, levothyroxine, rx-sample-thyroid.
      placeholder: "migraine"
    validations:
      required: true
  - type: textarea
    id: content
    attributes:
      label: Paste your proposed JSON entry
      description: English + Hindi required. Follow-up questions must be generic and non-diagnostic.
      render: json
    validations:
      required: true
  - type: checkboxes
    id: checks
    attributes:
      label: Contribution checks
      options:
        - label: All strings are bilingual (EN + Hindi Devanagari)
        - label: Follow-ups are generic history only (no diagnosis implied)
        - label: Synthetic/demo data only — no real patient or doctor personal data
        - label: I ran `npm run lint` and `npm run build` successfully
