name: Bug report
description: Something in SevaSetu isn't working as documented.
title: "[Bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting! Please fill in everything you can — it makes a fix much faster.
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: What you saw vs what you expected.
      placeholder: "Clicked calendar sync and got 'Calendar sync failed', expected new medicine events."
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: Numbered clicks from a fresh state if possible.
      placeholder: "1. Deleted data/sevasetu.db\n2. npm run dev\n3. Clicked 'Load Live Demo Flow'\n4. ..."
    validations:
      required: true
  - type: dropdown
    id: tab
    attributes:
      label: Which tab?
      options:
        - Pre-Visit Bay
        - Doctor Console
        - Post-Visit Prescription & Calendar
        - Diagnostics / setup
    validations:
      required: true
  - type: dropdown
    id: provider
    attributes:
      label: Gemma provider mode (see diagnostics drawer)
      options:
        - Fallback (no API key)
        - Google AI Studio (GOOGLE_API_KEY set)
        - Ollama Local
        - Not sure
    validations:
      required: true
  - type: input
    id: browser
    attributes:
      label: Browser + OS
      description: Voice input needs Chrome/Edge with mic permission.
      placeholder: "Chrome 126, macOS 15"
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Relevant logs
      description: Browser console errors and/or terminal output (redact any API keys).
      render: shell
  - type: checkboxes
    id: checks
    attributes:
      label: Pre-submit checks
      options:
        - label: I tested on a fresh DB (`rm -f data/sevasetu.db` then restart)
        - label: I redacted API keys/tokens from logs
        - label: This uses synthetic demo data only (no real patient info)
