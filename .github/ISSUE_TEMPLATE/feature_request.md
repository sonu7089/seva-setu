name: Feature request
description: Suggest an improvement to SevaSetu's clinic workflows.
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Small, focused proposals get built fastest. One workflow, one issue.
  - type: textarea
    id: problem
    attributes:
      label: Which user problem does this solve?
      description: Doctor, nurse at bay, or patient/family — and in which workflow (before or after the visit)?
      placeholder: "Nurses retype the same vitals for every follow-up visit..."
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposed change
      description: What should happen, step by step.
      placeholder: "1. Add a 'copy vitals from last visit' button...\n2. ..."
    validations:
      required: true
  - type: textarea
    id: scope
    attributes:
      label: Out of scope (what this is NOT)
      description: Keeps the PR small and reviewable.
      placeholder: "Not changing the Doctor brief format. Not adding diagnosis."
  - type: dropdown
    id: bilingual
    attributes:
      label: Bilingual impact
      description: Every user-facing string needs English + Hindi.
      options:
        - No new user-facing strings
        - New strings needed (I will provide EN + HI)
        - New strings needed (I need help with Hindi)
    validations:
      required: true
  - type: dropdown
    id: offline
    attributes:
      label: Offline fallback
      description: Every feature must work with no API key (fallback mode).
      options:
        - Works offline / N/A (no AI call involved)
        - I will include a fallback path
        - I need guidance on fallbacks
    validations:
      required: true
