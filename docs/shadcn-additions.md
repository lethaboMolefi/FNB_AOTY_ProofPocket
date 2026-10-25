# shadcn/ui additions (phase 5)

Branch `dashboard-cleanup`. Baseline for the "untouched" check: commit `2c31e14` (end of phase 4).

## Stack check

- shadcn/ui was already set up: `apps/web/components.json` (style `default`, aliases `@/components`, `@/components/ui`, `@/lib/utils`, icon library lucide), on React 19, Vite 8 and Tailwind 4. It was **not** re-initialised, and its config was not changed.
- `components.json` still points `tailwind.config` at `tailwind.config.ts`, which no longer exists (Tailwind 4 keeps the theme in `src/styles/index.css`). The shadcn CLI may need `"config": ""` before it can add components. This was left alone, because no new shadcn component was added (see "Not converted").

## List A: already shadcn/ui, left untouched

- **`components/ui/*`:** `badge`, `button`, `callout`, `card`, `field`, `input`, `label`, `progress`, `radio-group`, `select`, `separator`, `table`, `textarea`.
- **Fully shadcn screens:** founder `Home`, `Cashflow`, `Funding`, `Markets`, `More`, `Procurement`, `Protection`, `Settings`, `Start`, `Stock`, `FounderHead`; admin `Applications`; `Join`, `SignIn`; `FounderShell`, `TopBar`, `PageHeader`.
- **shadcn elements inside the mixed files** (`Books`, `Payments`, `Privacy`, `NotificationPanel`): every existing Card, Button, Input, Table, Badge and Callout in them.

## List B: not using shadcn/ui before this phase

| File | Elements | Now |
|---|---|---|
| `features/checks/Checks.tsx` (both checker queues) | `.panel`, `.li`, `.btn`, `.field` inputs, `LevelPill`, `PageHead` | Card, Button, TextField, Callout, Badge (`LevelBadge`), `PageHeader`, empty state with icon |
| `features/admin/Organisations.tsx` | `.panel` forms and lists, `.btn`, `.field`, select, sector checkbox chips, `Pill` | Card, Button, TextField, NativeSelect, ToggleChips, Badge |
| `features/admin/Reviews.tsx` (Reports, Feature requests, Flagged payments, Tenders & buyers) | `.panel`, `.li`, `.btn`, `.field`, chips, legacy `<table>`, `Pill` | Card, ListRow, Button, TextField, ToggleChips, Table, Badge, empty states |
| `features/adviser/Cohort.tsx` | `.stat` tiles, `.panel`, `.li`, `.btn`, board cards, `Pill` | StatCard, Card, ListRow, Button, Badge; board columns keep their grid |
| `features/adviser/Attention.tsx`, `Support.tsx`, `AdviserDrawer.tsx` | `.panel`, `.li`, `.tl` timeline, `.btn`, `.field`, textarea, select | Card, ListRow, Button, NativeSelect, Label + Textarea, Badge |
| `features/funder/Pipeline.tsx` | `.stat` tiles, filter `.field`s, legacy table, `Pill` | StatCard, TextField, NativeSelect, Table, Badge |
| `features/funder/Applications.tsx`, `Programmes.tsx`, `ProgrammeForm.tsx`, `FunderDrawer.tsx` | legacy table, `.panel`, `.stat`, `.bar`, chips, `.btn`, `.field`, `Notice` | Table, Card, Progress, Button (toggle chips), TextField, NativeSelect, Callout, Badge |
| `components/CompanyDrawer.tsx` (funder and adviser drawer) | `.panel`, `.stat`, legacy table, `.li`, `.steps`, `.tl`, `Pill`, `Notice`, `.btn` | Card, Table, Badge, Callout, Button; stage list and timelines as styled lists |
| `components/layout/PortalShell.tsx` | `.rail-link` text-only sidebar | NavLink rows in the founder sidebar's style, with lucide icons |
| `components/FilePick.tsx` | label styled `.btn` | `buttonVariants` from the shadcn Button, with Upload/Loader icons |
| `features/founder/PrivacyNoticePrompt.tsx` | `Notice`, `.btn` | Callout, Button |
| `features/founder/Books.tsx` (mixed) | statement preview `<table>`; Money in/out toggle buttons; receipt "Remove"; "Earlier months" toggle | Table; Buttons with `aria-pressed`; Button `link`; Button `ghost` |
| `features/founder/Payments.tsx` (mixed) | "Ways the client can pay" chip buttons | Buttons with `aria-pressed` |
| `features/founder/Privacy.tsx` (mixed) | native radio inputs for the sharing level | RadioGroup + RadioGroupItem (already installed) |
| `components/NotificationPanel.tsx` (mixed) | bell, Clear all, Close and Dismiss as raw buttons | Button `ghost` / `icon` |

## Added (new files, outside `components/ui`)

| File | What it is |
|---|---|
| `components/ToneBadge.tsx` | `ToneBadge` and `LevelBadge`: the app's tones (good, warn, bad, info, plain) as shadcn Badge variants, replacing `Pill` on converted screens |
| `components/StatCard.tsx` | Figure + label + icon in Card, copying Home's `MetricCard` style (Home keeps its own copy) |
| `components/ListRow.tsx` | One `<li>` row: details left, status or actions right, stacked on phones |
| `components/EmptyState.tsx` | Icon + message + optional action for empty lists |
| `components/ToggleChips.tsx` | "Pick several" as shadcn Buttons with `aria-pressed` in a labelled fieldset |

No shadcn component was added with the CLI, and no file in `components/ui` was created or overwritten.

## Icons added (lucide-react, 16 px `h-4 w-4`, as on the existing screens)

- **Portal sidebar items:** Company pipeline, Applications, Programmes, Set requirements, Cohort board, Document checks, Needs attention, Support log, Checker queue, Organisations, Reports, Feature requests, Flagged payments, Tenders & buyers.
- **Buttons:** Approve, Send back, Open file, Resolve, Dismiss, Feature, Reject, Confirm scam, Clear, Publish, Invite, Verify/Unverify, Reset authenticator, Accept, Decline, Mark arranged, Save, Open, Change offer, Approve offer, Decline, Mark under review, Awaiting co-funding, Send invite, Add a programme, Close/Reopen programme, Move stage / Back a stage, drawer Close, Upload.
- **Stat cards:** Cohort (4) and Pipeline (4).
- **Card titles:** Organisations, Flagged payments, Tenders, Support log, Cohort requests, drawer sections.
- **Empty states:** checker queue, reports, feature requests, flagged payments, reported senders, tenders, history, attention, organisations, funder applications, programmes, pipeline (no match), drawer entries and activity.
- Elements that already had an icon (founder sidebar, phone tab bar, founder pages) were left alone.

## Behaviour kept

- Same API calls, data, validation messages, confirmations and wording.
- Lists are now real `<ul>`/`<li>`, so `e2e/join.spec.ts` and `e2e/phase5.spec.ts` find rows by role (`listitem`) instead of the old `.li` class. Nothing else in the tests changed.
- Fixes made while converting:
  - the portal layout and two screen-reader-only labels no longer let the page scroll sideways on phones
  - the bell's dismiss button is now visible on touch screens and on keyboard focus (it was hover-only)

## Not converted (needs a new package; ask first under CLAUDE.md)

| Element | shadcn component | Package needed |
|---|---|---|
| Native checkboxes (Personal purchase, Lead adviser, "This account is in the business's name", "Payee has no phone", Join consent) | Checkbox | `@radix-ui/react-checkbox` |
| Company drawer frame (custom `aside` dialog) | Sheet | `@radix-ui/react-dialog` |
| Minimum-readiness range slider (Pipeline) | Slider | `@radix-ui/react-slider` |
| Charts (`components/charts.tsx`: bars, ring, sparkline, score cell) | Chart | `recharts` |
| Collapsible "Earlier months" panel (Bookkeeping) | Collapsible | `@radix-ui/react-collapsible` (a ghost Button is used now) |

## Proof that list A was not changed

```
git diff --name-only 2c31e14 -- system/apps/web/src/components/ui        → (nothing)
git diff 2c31e14 -- <each fully-shadcn file listed above>               → (nothing)
```

In the four mixed files, `git diff 2c31e14` removes only the legacy elements listed in the table (raw `<table>`, `<button>`, radio `<input>`, and the bell's raw buttons). No existing shadcn element, variant, prop or className was edited.

## Checks

- Type check: pass. Lint: 0 errors.
- Unit and API tests: 213 / 213.
- Browser tests: 53 pass, 5 skipped by design. This includes the every-page, every-role sweep (`dashboard.spec.ts`), which checks for sideways scrolling, console errors and failed API calls.
