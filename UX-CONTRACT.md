# FLOW EOD Scanner UX Contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select in `DashboardControls` | `premium-ui.json` and saved scan dates | platform-owned popup for historical dates | browser smoke + build |
| Scrollbar | Global application stylesheet | `apps/web/src/app/globals.css` | `scrollbar-gutter` only for table surface geometry | premium audit + browser smoke |
| Search | Server-rendered GET form in `DashboardControls` | `apps/web/src/lib/live-scan.ts` | query by ticker or clear to latest day | unit tests + browser smoke |
| Manual Scan | Pessimistic client button in `DashboardControls` | `/api/scan/manual` dispatches GitHub Actions | current Vietnam date, success, error, submitting | unit tests + browser smoke |
| Table | Native semantic table in `ScanTable` | `apps/web/src/components/scan-table.tsx` | horizontal scroll with sticky ticker column | build + browser smoke |

## Behavior

The dashboard opens on the latest saved market date. The history select navigates to saved scan sessions. A ticker query searches across all saved dates and shows one row per stored session.

Manual scan is a remote mutation and stays pessimistic: the UI shows pending text, prevents duplicate submit, and only reports success after the API accepts the dispatch. Users do not enter a date or activation code; the server sends the current Vietnam date to GitHub Actions and keeps the GitHub token out of the browser.

The market header shows the selected session plus VNINDEX, breadth, liquidity, and the strongest ticker when the database has that market context. Missing market context renders as empty values rather than estimated numbers.

The result table remains the primary reading surface. On narrow screens the table scrolls horizontally rather than turning into cards, because column comparison matters for end-of-day review.

## Feedback

Inline status text is used for scan progress, success, and failure. News links open only when a verified URL exists in stored data.

## Locale

Owned UI copy uses Vietnamese. Dates use ISO values for filters and `vi-VN` formatting for published news timestamps where available.
