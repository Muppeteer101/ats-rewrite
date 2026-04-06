# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project

**ats-rewrite** — a single-page React app that rewrites a CV to be ATS-optimised against a specific job description, generates a tailored cover letter, explains the changes made, and (across multiple runs) provides cross-application career analysis. Calls Anthropic's Claude API via a tiny serverless proxy.

## Stack

- **Frontend:** React 18 + Vite 6 (ESM, `"type": "module"`), single-file app in `src/App.jsx` (~1160 lines).
- **Backend:** One Vercel serverless function at `api/rewrite.js` that proxies requests to `https://api.anthropic.com/v1/messages` so the API key never reaches the browser.
- **Model:** `claude-sonnet-4-6` (hardcoded in `api/rewrite.js`), `max_tokens: 4096`, `anthropic-version: 2023-06-01`.
- **Document parsing (browser-side):** `mammoth` for `.docx`, `pdfjs-dist` (legacy build) for `.pdf`, native FileReader for `.txt`. `.doc` is explicitly unsupported.
- **PDF export:** `html2pdf.js`.
- **Markdown rendering:** `react-markdown`.
- **Persistence:** `localStorage` only (no database). Keys: `ats-base-cv`, `ats-history` (capped at 50 entries), `ats-theme`.

## Layout

```
api/rewrite.js       Vercel serverless proxy → Anthropic Messages API
src/main.jsx         React entrypoint
src/App.jsx          Entire app: prompts, helpers, components, state
index.html           Vite entry; global font + scrollbar styles
vite.config.js       Dev proxy: /api → http://localhost:3001
vercel.json          Build config + SPA rewrite (preserves /api/rewrite)
.env.example         ANTHROPIC_API_KEY=...
.claude/launch.json  Dev launch config (npm run dev on port 5173)
```

## Scripts

- `npm run dev` — Vite dev server on `5173`. The dev server proxies `/api` → `localhost:3001`, so for end-to-end local testing run `vercel dev` (which serves both the Vite build and `api/rewrite.js`) instead of plain `npm run dev`. Plain `npm run dev` is fine for UI work that doesn't hit the API.
- `npm run build` — Vite production build to `dist/`.
- `npm run preview` — preview the built bundle.

No test, lint, or typecheck scripts are configured. Don't invent CI commands.

## `src/App.jsx` map

The file is intentionally monolithic. Section banners (`// ─── ... ───`) mark these regions:

1. **System Prompts** (L6–72) — `PROMPT_CV`, `PROMPT_CHANGES`, `PROMPT_COVER`, `PROMPT_CROSS`. These encode the product's core behaviour and editorial rules (e.g. "never fabricate", "change HOW, not WHAT"). Treat them as product copy — edit deliberately.
2. **API Helper** (L74) — `callAPI(system, prompt)` POSTs `{system, prompt}` to `/api/rewrite`.
3. **Persistence** (L90) — `loadBaseCV/saveBaseCV/clearBaseCV`, `loadHistory/saveHistory`.
4. **File Reader** (L108) — `readFileAsText(file)` dispatches by extension. PDF.js worker is loaded from a cdnjs URL using `pdfjsLib.version`.
5. **Extract Job Title** (L159) — heuristic from first 5 lines of the job description.
6. **Design Tokens / Theme** (L168) — `shared`, `darkTheme`, `lightTheme`, `loadTheme/saveTheme`. A module-level `let C = darkTheme` is mutated by `App` on toggle and read by every component. Keep this pattern when adding components — don't introduce a context provider unless asked.
7. **Components** — `AmbientOrbs`, `ThemeToggle`, `Spinner`, `Btn`, `GlassCard`, `MarkdownContent` (with `variant: 'screen' | 'document'`), `DropZone`, `StepIndicator`, `DocumentPreview` (A4-style), `ResultBlock`, `HistoryCard`.
8. **Main App** (L757+) — top-level state, the multi-step flow, history management, refinement loops, PDF export.

## Conventions

- **Inline styles only.** No CSS files, no Tailwind, no styled-components. New UI must use the `C.*` design tokens and read theme via the module-level `C`.
- **Single file.** Don't split `App.jsx` into multiple files unless explicitly asked. Add new sections under a matching `// ─── ... ───` banner.
- **British English** in user-facing copy and prompts (e.g. "optimise", "personalise"). Match it.
- **Never fabricate CV content** — this rule lives in the prompts and is the product's core promise. Don't weaken it.
- **API key** is server-side only. Never reference `ANTHROPIC_API_KEY` from `src/`. All model calls go through `/api/rewrite`.
- **Model ID** lives in one place (`api/rewrite.js`). If updating models, update there.
- **localStorage** is the only store. Wrap reads/writes in `try/catch` like the existing helpers (private mode / quota safety).
- **History cap** is 50 entries — preserve `slice(0, 50)` in `saveHistory`.
- **PDF.js** uses the `legacy/build/pdf.mjs` import path and a CDN worker. Don't switch to the modern build without also updating the worker URL.

## Deployment

Vercel. `vercel.json` builds with `npm run build`, serves `dist/`, and rewrites everything except `/api/rewrite` to `index.html` (SPA). The serverless function reads `ANTHROPIC_API_KEY` from Vercel project env vars.

## Working in this repo

- Read `src/App.jsx` before editing it — it's long but well-sectioned; jump via the banner comments.
- Prefer minimal, surgical edits. The codebase has no abstractions to "improve into" — resist refactoring unless asked.
- There is no test suite; verify changes by running `npm run build` and, where the API is involved, `vercel dev`.
- Branch policy for AI sessions: develop on the branch specified in the task, commit with clear messages, push with `-u origin <branch>`. Do not open PRs unless explicitly requested.
