# Document Verification Prototype

Standalone web app for comparing a user-uploaded PDF against a versioned reference PDF.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Workflow

1. **Reference Documents** — upload a template PDF (creates v1, v2, … without overwriting history).
2. **New Verification** — upload a user PDF, choose a reference version (or use the active one).
3. Watch processing stages, match %, issues, then open the report.
4. **History** — filter and reopen any run.
5. **Report** — side-by-side PDFs, override the automated decision (stored separately).
6. **Settings** — score weights and accept/reject rules.

## Architecture

| Layer | Location |
|---|---|
| UI | `app/`, `components/` |
| REST API | `app/api/` |
| Store | `lib/store.ts` → `data/store.json` + `data/uploads/` |
| Engine | `lib/verification-engine.ts` |

`POST /api/verify-document` is the integration point for an existing website.

## Engine honesty

The default engine is a **heuristic pdf.js adapter**: selectable text, layout boxes, and image operators. It is **not** a neural OCR or seal classifier. Swap `runVerificationEngine()` for Tesseract, Document AI, or a custom vision model. The UI labels this clearly; scores are real comparisons of extracted PDF data, not a canned pass/fail.
