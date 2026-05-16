# Arctium Labs

**Arctium Labs** is a web workspace for commercial shipping teams—chartering, operations, and bunkers—built as a fast, single-page application with a monospace, terminal-inspired interface and optional light or dark theme.

**Live site:** [arctiumlabs.com](https://arctiumlabs.com)

---

## What it does

The app brings several day-to-day maritime tools into one place. After signing in, you move between tabs for different workflows.

### Dashboard

- **Live fleet positions** — Admins can upload a KPLER-style position list (Excel workbook, `KPLER` sheet). The dashboard renders the fleet table; admins and ops can maintain **ETA OPEN** and related fields. Values persist across daily re-uploads until you change them.
- **Market instruments** — Live-style quote table (Twelve Data) for selected symbols.
- **Saved work** — Access saved scenarios from the dashboard.

### TC (time charter)

Compare multiple **time charter arcs** side by side: name the vessel, add arcs, set **global parameters** (discount rate, vessel type from MR tanker through dry bulk sizes or custom), and define **spot rate scenarios** (bear / base / bull TCE when trading spot). **Run analysis** to see comparative economics on the results panel.

### Spot (voyage chain comparator)

Model **voyage arcs** with vessel defaults (speeds laden/ballast, broker commission, VLSFO/LSMGO consumption and prices, port days, OPEX, date window, and more). Build chains, then **Compare arcs** to evaluate alternative voyage programs. Reset is available for a clean run.

### Bunkers

**Bunker Negotiator** — Configure delivery, quantities, and a **lump sum counter** with a target figure; use **Export** for outputs and **Reset** to start over.

### Emissions

**EU ETS–oriented voyage emissions** — Enter voyage details (vessel, route coverage 100% / 50%, compliance year, load/discharge ports with autocomplete backed by project port data), **fuel consumption** by type with emission factors, and **ETS parameters** (e.g. EUA price). **Calculate emissions** to populate the summary on the right.

---

## Technical overview

| Area | Notes |
|------|--------|
| **Frontend** | One self-contained `index.html` (markup, styles, and client logic). |
| **Auth** | [Supabase](https://supabase.com/) — sign-in overlay; user profiles support roles such as **admin** and **ops** (e.g. who may upload the position list). |
| **Data** | `ports.json`, `all_cargo_grades.json`, and `wet_cargo_grades.json` ship with the site for lookups and autocomplete. |
| **Assets** | `logo.svg`, `Favicon.svg`; `CNAME` is set for GitHub Pages–style hosting on `arctiumlabs.com`. |

To run locally, serve the repository root as static files (any static file server is fine) so assets and API calls behave consistently, then open the served URL in your browser.

---

## Who it is for

Operators, charterers, and analysts who want **TC comparison**, **voyage / spot chain comparison**, **bunker negotiation aids**, **ETS-related emission estimates**, and a **shared dashboard** for fleet visibility and market context—without juggling separate spreadsheets for every task.

---

*Arctium Labs — shipping economics and operations in one workspace.*
