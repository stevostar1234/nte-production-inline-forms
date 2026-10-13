# NTE production inline forms

Self-contained HTML code blocks, saved as `.txt`, for the NTE website. They
match https://stevostar1234.github.io/nte-production-forms/ and submit to the
same production Salesforce org. Volunteers are excluded.

- `code-blocks/`: ten forms and two supporting pages.
- `previews/`: the exact code blocks in minimal HTML pages.
- `source/`: the production source snapshot.
- `source-manifest.json` and `build-manifest.json`: source and output hashes.
- `INSTALL.txt`: website handover and current terms links.
- `nte-squarespace-code-blocks.zip`: all blocks and installation instructions.

## Build and check

Use Node.js with `npm ci`, then `npm run build` and `npm test`.
Serve this folder locally on port 8766 and run `npm run test:browser` after
installing Playwright Chromium. The browser suite intercepts every form POST;
it must never create Salesforce records or send emails. It compares responsive
pixels, field constraints, conditional choices, native payloads and resistance
to host-theme CSS. `python3 scripts/package.py` creates the handover ZIP.

`hosting.json` can map final page and return URLs. After changes to source,
refresh the source hashes, rebuild, run parity checks and replace the entire
code block. Never edit generated blocks individually. The Shadow DOM wrapper
isolates the form from the website theme; inline CSS and JavaScript come from
the same source as the hosted forms.

## Current release boundary

Production Salesforce intake and live Stripe are enabled. Kate's final terms
are linked by audience through `termsUrls`; the temporary unlinked-terms
exception is disabled. Separate required checkboxes populate the existing
production privacy and terms fields. The owner selected partner/sponsor terms
for Delivery Partners. Historical test ticks are not final-terms acceptance.

PDFs are linked externally, not embedded in code blocks. Replace previously
installed application blocks with this release. The brochure and final
client-hosted form/PDF URLs remain outstanding. Regenerate blocks when those
URLs change. Do not create real records or payments to test this repository.

This repository contains public form code and public Web-to-Lead field IDs;
it must never contain client records, Stripe keys or Salesforce credentials.
