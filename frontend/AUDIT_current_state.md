# Lattice Frontend Audit

**Date:** 2026-09-16
**Scope:** `/Users/arijitdas/Loom/frontend` — the entire Vite + React 19 + TypeScript + Tailwind v4 + React Router 7 control-plane app.
**Method:** full read of every file under `src/`, live `npm run build` and `npm run lint` (`tsc --noEmit`) runs, dependency/security greps, and spot-verification of the findings below directly against source.

## 0. State of the project — one paragraph

This is a single-commit, prototype-stage frontend (`git log --oneline -- frontend/` shows exactly one commit for the whole tree). It was adopted from an AI-Studio-generated scaffold and lightly cleaned up once. It builds cleanly and typechecks cleanly today, but that's a weak signal: there is no ESLint, no test suite, no CI, and TypeScript `strict` mode is off, so nothing is actually enforcing code quality beyond "does it compile." The app is 100% mock-data-driven by deliberate design (backend integration is intentionally deferred), which is fine — but the mock data itself has structural bugs (not scoped per content type) that make most of the app's secondary pages show identical, wrong data no matter what the user clicks. A large fraction of the UI (roughly half of all buttons/links/inputs) is visually complete but wired to nothing.

Rough counts: 33 tracked files, ~1,700 lines of app code, 0 tests, 0 CI workflows, 1 commit.

---

## 1. Critical bugs (visibly wrong behavior today)

| # | File:Line | Bug |
|---|---|---|
| 1.1 | `src/lib/mock-data.ts` (whole file) | `mockSchemaFields`, `mockSchemaVersions`, and `mockEntries` are **global singletons with no `contentTypeId` scoping** (only `mockEntries` even has a `contentTypeId` field, and every single entry hardcodes `'ct_products'`). Root cause of bugs 1.2–1.4 below — fix this once, in one place, and three pages become correct. |
| 1.2 | `src/pages/content-types/EntriesList.tsx:53` | Renders `mockEntries` with **no filter** on `contentType.id`. Visiting `/content-types/orders/entries` or `/content-types/customers/entries` shows the same 5 Products rows with Products-only columns ("Category", "Price"). Verified directly — line 53 is a bare `.map()`, no `.filter()` anywhere in the file. |
| 1.3 | `src/pages/content-types/SchemaEditor.tsx`, `src/pages/content-types/SchemaVersions.tsx` | Both import `mockSchemaFields`/`mockSchemaVersions` directly, ignoring the `contentType` from `useOutletContext` (which is destructured but never used — see §5). Every content type's schema/version pages show identical Products-schema data. |
| 1.4 | `src/pages/content-types/EntryEditor.tsx:65` | Same issue: form fields always come from the single global `mockSchemaFields`, regardless of which entry/content type is being edited. |
| 1.5 | `src/pages/content-types/EntryEditor.tsx:84` | `<option key={opt} value={opt} selected={entry.data[field.name] === opt}>` — sets the `selected` attribute directly on `<option>` inside an uncontrolled `<select>` with no `value`/`defaultValue` on the `<select>` itself. This is a documented-unsupported React pattern; the dropdown will not actually preselect the entry's stored enum value — it'll just show the browser's default (first option). **Verified directly by reading the file.** Fix: use `<select defaultValue={entry.data[field.name]}>`. |
| 1.6 | `src/pages/content-types/SchemaVersions.tsx:10,31` | `selectedVersion` is hardcoded to `mockSchemaVersions[0]` via plain assignment, **not `useState`**. Version cards have `cursor-pointer` and conditional "selected" styling implying they're clickable, but there is no `onClick` anywhere in the file — clicking any version other than the first does nothing. Looks like a regressed/unfinished feature (compare to the near-identical `SchemaEditor.tsx` pattern, which does correctly wire `onClick={() => setSelectedField(field)}`). |
| 1.7 | `src/pages/content-types/ContentTypeWorkspace.tsx:11`, `EntryEditor.tsx:11-12` | `mockContentTypes.find(ct => ct.slug === slug) || mockContentTypes[0]` (and the equivalent for entries). An invalid/stale/typo'd URL **silently renders the first item** instead of a not-found state — the address bar won't match what's displayed, masking real bugs and confusing anyone following a bad link. |
| 1.8 | `src/pages/content-types/ContentTypeOverview.tsx:57-58,105` | "12 fields", "5 required · 3 optional · 4 rules", "5 endpoints" are **static hardcoded strings**, not derived from `contentType`/`mockSchemaFields` (which actually has 6 fields) or `ApiDocs.tsx` (which only documents 1 endpoint). Shows the same fabricated numbers for every content type. |
| 1.9 | `src/pages/content-types/ContentTypeOverview.tsx:36,39` | "Created: Jan 15, 2026" / "Updated: Sep 15, 2026" are hardcoded literals, ignoring `contentType.updatedAt` which is used correctly elsewhere in the same file (line 82) and does vary per content type in the mock data. |
| 1.10 | `src/App.tsx` (catch-all route) | Unknown paths `Navigate` straight to `/` with **no actual 404 page** and no user feedback — silently hides routing bugs (including the dead sidebar links in 1.11). |
| 1.11 | `src/components/layout/AppShell.tsx:88,104,120,130` | Sidebar links to `/entries`, `/api-docs`, `/activity`, `/settings` — **none of these routes exist** in `App.tsx`. Clicking any of them silently redirects home via the catch-all, with zero error indication. |

## 2. Non-functional / dead UI (styled and clickable-looking, but wired to nothing)

Grouped by page — every item below has no `onClick`/`onChange`/handler at all:

- **`AppShell.tsx`**: workspace switcher items "Acme Inc." (33), "Stark Industries" (37), "Create Workspace" (42); account menu "Profile"/"Billing"/"Preferences"/"Log out" (159-163). The visible search button (line 51) doesn't call the palette's own open-setter — it fakes a `⌘K` keydown via `document.dispatchEvent(new KeyboardEvent(...))` instead, because `cmdOpen`/`setCmdOpen` (owned by `App.tsx`) was never threaded down. Fragile; should be lifted to context or `Outlet` context.
- **`CommandPalette.tsx`**: the search `<Input>` (23) has no `value`/`onChange` — typing does nothing despite the "Type a command or search..." placeholder. Every Navigation/Actions row (30-55) is a plain `<div>` with hover styling but no `onClick` and isn't a `<button>`/`role="button"` — not keyboard-reachable at all.
- **`WorkspaceOverview.tsx`**: "Manage" (33), "New Content Type" (40), "View all" (85), all three Quick Actions buttons (107-115), per-row `MoreHorizontal` (70).
- **`ContentTypesList.tsx`**: search input (28, no `value`/`onChange`), "Filter" (30), "New Content Type" (21), pagination arrows/page-number "1" (74-76, purely decorative, arrows are `disabled`).
- **`ContentTypeWorkspace.tsx`**: `MoreHorizontal` "..." button (38).
- **`ContentTypeOverview.tsx`**: "Edit" button (16).
- **`SchemaEditor.tsx`**: "Preview" (24), "Save changes" (25), "Add field" (81), delete/`Trash2` button (100), "Advanced options" (162). Field name input, type `<select>`, and both checkboxes are `readOnly`/`disabled` but styled identically to editable controls with no visual "disabled" affordance.
- **`SchemaVersions.tsx`**: "New version" (19), "View changes" (86), plus the non-clickable version cards from bug 1.6.
- **`EntriesList.tsx`**: "New entry" (20), "Filters" (30), "Sort" (31-34), header select-all + per-row checkboxes (42, 56, no state), page-number buttons "2"/"3"/"50" (86-89).
- **`EntryEditor.tsx`**: "Cancel"/"Save changes" (42-43), tag remove "×" and "+ Add tag" (102, 105), JSON tab "Copy" button (127, no clipboard call despite being labelled as one). The whole form is uncontrolled `defaultValue`s with zero dirty-state tracking or unsaved-changes warning (acceptable given no persistence exists yet, but worth knowing before wiring saves).
- **`ApiDocs.tsx`**: sidebar links to `#get`/`#create`/`#update`/`#delete` (14-22) point to anchors that don't exist — only `<section id="list">` (35) is real. "Request/Response/Code example" sub-tabs (45-47) are plain buttons with active-looking classes but no state/`onClick` — clicking "Response" does nothing; this duplicates the app's own `Tabs` component (already used correctly in `SchemaEditor.tsx`/`EntryEditor.tsx`) instead of reusing it. "View in API docs" (30) and the code-block "Copy" button (52-54) are also dead.

## 3. Accessibility issues

- **`SchemaEditor.tsx:50-53`** — field rows are `<tr onClick={...}>` with `cursor-pointer` but no `role="button"`, `tabIndex`, or `onKeyDown` — not keyboard-reachable, no screen-reader affordance that the row is interactive.
- **`CommandPalette.tsx:30-55`** — same issue: clickable-styled `<div>`s with no semantic role or keyboard handling (compounded here by also having no `onClick` at all, per §2).
- **`CommandPalette.tsx`** — `<DialogContent>` renders with no `<DialogTitle>`/`<DialogDescription>`, even though `src/components/ui/dialog.tsx` exports both. Radix will emit a real runtime console warning every time this dialog opens ("`DialogContent` requires a `DialogTitle`...").
- **`EntryEditor.tsx:67`** — none of the field `<label>` elements have `htmlFor` matching an `id` on their `<Input>`/`<select>`/`<textarea>`/checkbox. Labels are associated by visual grid position only — breaks screen-reader form navigation for every field type (String/Number/Enum/Boolean/Array/Object).
- **`ApiDocs.tsx:52-54`** — the "Copy" button is only revealed via `opacity-0 group-hover:opacity-100`, with no `focus-visible:opacity-100` fallback. Keyboard users tabbing to it get an invisible-but-focusable button.
- **`AppShell.tsx:27,153`** — "▼" chevron glyphs are raw Unicode text characters instead of the already-imported `lucide-react` `ChevronDown` — minor, but also means these glyphs won't respect icon sizing/accessibility conventions used everywhere else.

## 4. Code quality, duplication, cleanup candidates

- **Toolbar + table + pagination duplication** — `ContentTypesList.tsx` and `EntriesList.tsx` independently hand-roll a near-identical search-icon-in-input + filter-button toolbar (`ContentTypesList.tsx:26-30` / `EntriesList.tsx:25-30`), the same `bg-white border border-neutral-200 shadow-sm rounded-xl overflow-hidden` table card shell, and the same pagination footer markup (`ContentTypesList.tsx:71-78` / `EntriesList.tsx:81-92`, all of it non-functional per §2). Extract `<DataTableToolbar>` and `<TablePagination>` components.
- **Status-pill/dot duplication** — the green/neutral status-dot pattern (`WorkspaceOverview.tsx:66`, `ContentTypesList.tsx:61`) and the Published/Draft `<Badge>` pattern (`EntriesList.tsx:69-73`, similar in `SchemaVersions.tsx`) are re-implemented inline in multiple files instead of a shared `<StatusBadge>`/`<StatusDot>`.
- **Duplicated hand-rolled icons** — `DatabaseIcon` is defined twice with different sizes/coverage (`WorkspaceOverview.tsx:124-129` vs `ContentTypesList.tsx:84-90`), and `SchemaEditor.tsx:174` hand-writes a `ChevronRightIcon()` despite `lucide-react`'s `ChevronRight` already being imported/used in sibling files. `lucide-react` is the established icon library (used in 13 files) — these hand-rolled SVGs are inconsistent and will drift further.
- **No shared `Checkbox` component** — three checkbox `<input>` elements in `SchemaEditor.tsx` (128, 132, 156) and two in `EntriesList.tsx` (42, 56) repeat the exact same long className string verbatim, unlike every other primitive (`Input`, `Button`, `Badge`, etc.) which is properly wrapped under `src/components/ui/`.
- **Repeated NavLink active-class strings** — `AppShell.tsx`'s sidebar links repeat the same `cn(...)` ternary pattern 6 times (63-134); `ContentTypeWorkspace.tsx`'s tab links repeat a near-identical pattern 5 times (48-87). Both are candidates for one shared `navLinkClass()`/`<SidebarLink>` helper. Note existing inconsistency in *which* links get special active-matching logic (Content Types link checks `location.pathname.includes(...)` in addition to `isActive`; Entries tab does the same; nothing else does) — worth reconciling once extracted.
- **Dead design-system variants** — `Badge`'s `"warning"` variant (`badge.tsx:18`) and `Button`'s `"destructive"` variant (`button.tsx:14-15`) are defined but never used anywhere (confirmed via grep) — meanwhile `SchemaEditor.tsx:100` hand-rolls red delete-button styling instead of using the existing `variant="destructive"`.
- **Unused variables** — `contentType` is destructured from `useOutletContext` but never read in `SchemaEditor.tsx:12` and `SchemaVersions.tsx:9` (a symptom of bug 1.3). Not caught today because there's no ESLint (see §6).
- **`key={index}` anti-pattern** — `EntryEditor.tsx:100` (`tags.map((tag, i) => <Badge key={i}>`) and `SchemaVersions.tsx:79` (`changes.map((change, i) => <li key={i}>`). Low risk today since both lists are effectively static, but risky once tag add/remove is wired up (index-keyed reordering causes incorrect DOM/animation reuse).
- **Redundant background color** — `AppShell.tsx:173` sets `bg-[#fafafa]` as an arbitrary Tailwind value, duplicating the exact same color already set globally in `src/index.css:12` (`body { background-color: #fafafa; }`).
- **`AppShell.tsx:81`** — Content Types nav link mixes `isActive || location.pathname.includes('/content-types')` while every sibling link only checks `isActive` — inconsistent active-matching strategy, same root pattern noted above.

## 5. Architecture gaps (expected at this stage, but worth planning for)

- **No data-fetching abstraction** — every page does `import { mockX } from "@/lib/mock-data"` and reads it directly at module scope. There's no `useContentTypes()`/`useEntries()` hook, no service/repository layer, and no loading/error/success state modeling anywhere. This is consistent with the explicit decision to not wire up the backend yet, but it means introducing real API calls later will require building this layer from scratch everywhere at once, not swapping one import.
- **`.env.example`'s `VITE_API_BASE_URL` is entirely unused** — zero references to `import.meta.env` or `VITE_` anywhere in `src/`. Confirms there's no partial API wiring to build on.
- **No error boundaries anywhere** — a runtime error in any page (e.g. a hypothetical null-deref if `useOutletContext` ever returned `undefined`) would white-screen the whole app.
- **No loading/skeleton or empty states anywhere** — reasonable given the mock-only scope, but there isn't even placeholder UI to build on later (e.g. `EntriesList.tsx` would render 5 unrelated Products rows instead of an empty state for content types that truly have zero entries, once bug 1.2 is fixed).
- **No tenant/organization segment in routing** — `App.tsx`'s routes are all `/content-types/...` with no `/organizations/:orgId/...` prefix, despite the app being explicitly multi-tenant per the backend domain model and the README ("manage organizations, content types..."). There's a `Workspace` concept in `types/index.ts` but it's never reflected in the URL, and the workspace switcher (§2) has no real switching logic.
- **Domain-naming mismatch** — the frontend uses `Workspace` / `SchemaField` / `SchemaVersion` throughout, while the backend's canonical domain model (per `Decisions.md`) uses `Organization` / `Field` / `ContentTypeVersion`. `mockWorkspace` is also a single flat object with no `mockOrganizations` array, even though the sidebar UI implies multiple orgs exist. A rename/alias pass will be needed before real backend integration to keep names aligned and avoid confusing mapping code.
- **`Entry.data: Record<string, any>`** (`src/types/index.ts:51`) — the one explicit `any` in the codebase. Makes every `entry.data.category`/`entry.data.price` access fully untyped with no compile-time safety, and is the reason `EntriesList.tsx`'s hardcoded "Category"/"Price" columns (Products-specific, in a component routed generically for any content type) went uncaught.
- **`SchemaField.validations.max`** (`types/index.ts:28`) is declared but never read anywhere in the UI — `SchemaEditor.tsx:152`'s "Maximum value" input never binds `value={selectedField.validations?.max}`, unlike "Minimum value" right next to it (line 148) which correctly binds `validations?.min`.

## 6. Security / secrets scan — clean, with minor notes

- No `dangerouslySetInnerHTML`, `eval(`, hardcoded secrets/API keys, or `localStorage`/`sessionStorage` misuse anywhere in `src/` (confirmed by grep across the whole tree).
- The only "secret-looking" strings are cosmetic mock/doc placeholders: the `'api-key-regenerated'` activity-type enum value (`types/index.ts:59`, `mock-data.ts:100`, `WorkspaceOverview.tsx:134`) and a placeholder `Authorization: Bearer <API_KEY>` in the docs sample (`ApiDocs.tsx:58`) — both fine, not real credentials.
- **External CDN font import** — `src/index.css:1-2` pulls Geist Sans/Mono live from `cdn.jsdelivr.net` at runtime rather than bundling them. Worth flagging both as a minor performance concern (extra render-blocking request, no self-hosted fallback) and a light supply-chain consideration (third-party CDN in the critical rendering path).
- No `console.log`/`debugger`/`TODO`/`FIXME` statements anywhere in `src/` — the code is clean of debug leftovers (though this also means nothing marks the dead buttons in §2 as intentionally stubbed vs. accidentally incomplete).

## 7. Config & tooling gaps

- **No ESLint or Prettier at all** — no `.eslintrc*`/`eslint.config.*`, no `.prettierrc*`, no `.editorconfig`, and neither package appears in `package.json`. The `"lint"` script (`package.json`) is just `tsc --noEmit` — a type-check, not a linter. This is why the unused-variable and duplicated-JSX issues above went uncaught; an `eslint-plugin-jsx-a11y` would also have flagged the accessibility issues in §3 automatically.
- **TypeScript `strict` mode is off** — `tsconfig.json` has no `"strict": true` (or any of its constituent flags). `npx tsc --noEmit` currently passes with 0 errors, but that's a weak guarantee given `noImplicitAny`/`strictNullChecks`/etc. are all disabled.
- **`experimentalDecorators: true`** is enabled in `tsconfig.json` but nothing in the codebase uses decorators — dead config, likely inherited from a template and never pruned.
- **Duplicate `vite` entry** — `package.json` lists `"vite": "^6.2.3"` in both `dependencies` and `devDependencies`.
- **Unused dependencies** — `motion` (Framer Motion, `^12.23.24`) has zero imports anywhere in `src/`; `autoprefixer` (devDependency) has no consuming `postcss.config.*` (Tailwind v4's `@tailwindcss/vite` plugin handles this internally). Both are safe to remove.
- **Leftover AI-Studio scaffold artifact** — `src/App.tsx` has a stray `/** @license SPDX-License-Identifier: Apache-2.0 */` header at the top, the only file in the repo with one, and there is no `LICENSE` file and no actual Apache-2.0 licensing decision behind it. Remove the header, or add a real `LICENSE` if that's actually the intended license.
- **No `postcss.config.js`, no `tailwind.config.*`** — this is expected and correct for Tailwind v4's CSS-first config (via `@tailwindcss/vite`), not a bug, but worth noting explicitly so it isn't mistaken for a missing file later.
- **README gaps** — `README.md` accurately covers `npm install`/`cp .env.example .env`/`npm run dev`, but never mentions `npm run build`, `npm run preview`, or `npm run lint`, and doesn't mention that the app currently runs entirely on mock data with no live backend calls — a new contributor following it as-is would expect real data.
- **Single `tsconfig.json`** — no split `tsconfig.app.json`/`tsconfig.node.json` (Vite's more common modern template). Not a bug, just worth knowing if adopting other Vite-template conventions later.

## 8. Build & bundle health (live output, captured 2026-09-16)

`npm run build`:
```
vite v6.4.3 building for production...
✓ 1778 modules transformed.
dist/index.html                   0.78 kB │ gzip:   0.37 kB
dist/assets/index-CTVp1Dg6.css   38.82 kB │ gzip:   7.32 kB
dist/assets/index-CAnHvO-I.js   468.09 kB │ gzip: 139.42 kB
✓ built in 1.49s
```
No warnings. The JS bundle (468 KB / 139 KB gzip) is just under Vite's 500 KB chunk-size warning threshold, in a single chunk with no code-splitting configured (`vite.config.ts` has no `build.rollupOptions.output.manualChunks`, and no route uses `React.lazy`). Not urgent today given the app's small size, but worth revisiting once more pages/dependencies are added — it will silently cross the warning threshold.

`npm run lint` (`tsc --noEmit`): **0 errors.** (See §7 for why this is a weaker signal than it looks — `strict` is off.)

## 9. Tech-stack & tooling recommendations (prioritized)

**High priority — cheap now, expensive later:**
1. Add ESLint (flat config) with `@typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`; add Prettier for formatting. Rename the current `tsc --noEmit` script to `typecheck` and add a real `lint` script.
2. Turn on `"strict": true` in `tsconfig.json` now, while the codebase is ~1,700 lines — retrofitting strict mode gets exponentially more painful as the app grows.
3. Scope `mock-data.ts` by `contentTypeId` (add it to `SchemaField`/`SchemaVersion`, and populate entries for every content type, not just Products) — this single change fixes bugs 1.2, 1.3, and 1.4 at once.

**Medium priority — good investment before backend integration begins:**
4. Add Vitest + React Testing Library (pairs natively with Vite, no extra bundler config needed) — there is currently zero test infrastructure of any kind.
5. Add a minimal GitHub Actions CI workflow (`typecheck` + `build` + `lint`) — there is currently no CI at all.
6. Introduce a thin `hooks/`/`data/` layer now, even while still mock-backed (e.g. `useContentTypes()`, `useEntries(contentTypeId)` returning a `{data, isLoading, error}` shape) so that wiring the real API later is a swap of the hook's internals, not a rewrite of every page. This is worth doing in a way that's inert until the backend is actually connected, consistent with the explicit "don't wire it yet" boundary on this project.
7. Extract the shared `<StatusBadge>`, `<Checkbox>`, `<SidebarLink>`, `<DataTableToolbar>`, and `<TablePagination>` components identified in §4 — removes real duplication and makes the eventual "make pagination/search actually work" pass touch one place instead of four.

**Lower priority / polish:**
8. Self-host the Geist fonts (e.g. `@fontsource/geist` or bundled `.woff2` files) instead of the live jsdelivr `@import` in `index.css`.
9. Code-split routes with `React.lazy` once the page count/bundle size grows further.
10. Remove the stray Apache-2.0 SPDX header in `App.tsx` (or add a real `LICENSE`), remove the unused `motion` and `autoprefixer` dependencies, and dedupe the `vite` entry across `dependencies`/`devDependencies`.
11. Update `README.md` to mention `build`/`preview`/`lint` and the current mock-data-only status.

## 10. Summary table — everything by severity

| Severity | Count | Examples |
|---|---|---|
| Critical bug | 11 | Mock data not scoped per content type; broken `<select>` preselection; dead version-selection state; silent bad-URL fallback |
| Dead/non-functional UI | ~40 elements across 11 files | See §2 for full inventory |
| Accessibility | 6 | Non-semantic clickable rows, missing label associations, missing DialogTitle |
| Code quality / duplication | 10 | Toolbar/table/pagination duplication, duplicated icons, no shared Checkbox, dead design-system variants |
| Architecture gap | 7 | No data layer, no error boundaries, no org/tenant routing, domain-naming mismatch, untyped `Entry.data` |
| Security | 0 real issues | Clean scan; 2 minor notes (CDN fonts, unused env var) |
| Config/tooling | 9 | No ESLint/Prettier/tests/CI, `strict` off, dead deps, stray license header |

**Bottom line:** the visual layer is solid (consistent Tailwind usage, no inline styles, a proper shadcn/Radix component base) but roughly half the interactive surface is decorative, and the mock-data layer has a single structural bug (missing `contentTypeId` scoping) that's responsible for most of the app showing wrong data on every page except the one it was designed around (Products). Fixing that one file, adding ESLint + `strict` mode, and extracting the ~5 duplicated components in §4 would resolve the large majority of findings here in a small, well-scoped pass.
