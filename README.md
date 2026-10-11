# NTE production inline forms

Self-contained HTML code blocks, saved as `.txt`, for the NTE website. They
match https://stevostar1234.github.io/nte-production-forms/ and submit to the
same production Salesforce org. Volunteers are excluded.

- `code-blocks/`: ten forms and two supporting pages.
- `previews/`: the exact code blocks in minimal HTML pages.
- `source/`: the production source snapshot.
- `source-manifest.json` and `build-manifest.json`: source and output hashes.
- `INSTALL.txt`: website handover and the temporary terms-testing limitation.
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

Production Salesforce intake is enabled for client testing. Final terms are
awaited: `allowUnlinkedTermsForTesting: true` is explicitly owner-approved for
these fictional tests, with separate required consent checkboxes. Set the final
`termsUrl` and remove this exception before public launch. Test checkbox values
must not be represented as acceptance of the final terms. Live Stripe, final
notification inboxes and the client's website URLs are separate launch steps.

This repository contains public form code and public Web-to-Lead field IDs;
it must never contain client records, Stripe keys or Salesforce credentials.
