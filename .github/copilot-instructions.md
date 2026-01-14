# Copilot Instructions for NCT Booking Checker

## Project Overview

NCT Booking Checker is an automated Playwright-based web scraper that monitors Irish National Car Testing (NCT) booking availability. It checks 5 test centers every 30 minutes via GitHub Actions, filters available slots within a 14-day window, and reports findings via console output.

**Key Insight:** This is a stateless automation script—no database, just Playwright form navigation, data extraction, and console logging. Each run is independent.

## Critical Architecture & Data Flow

The test runs in a **single linear flow** through the NCT website:

1. **Navigation & Acceptance** → Visit `ncts.ie`, accept cookies
2. **Vehicle Lookup** → Enter car registration (env var), submit form
3. **Booking Verification** → Check 2 checkboxes (agree terms, privacy policy)
4. **Booking Management** → Confirm existing vehicle booking, select "reschedule"
5. **Booking ID Entry** → Enter booking ID (env var)
6. **Test Center Loop** → For each of 5 centers, dropdown-select → parse available dates → filter by 14-day window
7. **Output** → Print results to console (no file writes)

**Why this design matters:** The script MUST follow this exact sequence because the website progressively enables forms only after prior steps. Skipping or reordering steps will cause selectors to fail or forms to be disabled.

## Critical Configuration & Secrets

- **`CAR_REGISTRATION`** (GitHub secret / `.env.local`) → Used in Step 3, injected via `process.env.CAR_REGISTRATION`
- **`BOOKING_ID`** (GitHub secret / `.env.local`) → Used in Step 5, injected via `process.env.BOOKING_ID`
- **`.env.local`** (local dev only) → Copy from `.env.example`, add both `CAR_REGISTRATION` and `BOOKING_ID` for local testing
- **GitHub Secrets** (CI/CD) → Both secrets must be added to repository Settings → Secrets and variables → Actions

**Important:** Both values are read from environment variables (line 16-17 in spec file). Never hardcode sensitive booking information in the test file.

## Developer Workflows

### Local Testing
```bash
npm install  # One-time setup, installs @playwright/test and dotenv

# Headed (visible browser)
npx playwright test playwright/nct-booking-checker.spec.ts --headed

# Headless (CI-like environment)
npx playwright test playwright/nct-booking-checker.spec.ts
```

**Note:** Requires `.env.local` with both `CAR_REGISTRATION` and `BOOKING_ID` before running locally.

### GitHub Actions (Production)
- **Trigger:** Every 30 minutes via cron (`*/30 * * * *`), or manual `workflow_dispatch`
- **Environment:** Ubuntu latest, Node 18, Chromium installed automatically
- **Secrets Required:** Both `CAR_REGISTRATION` and `BOOKING_ID` must be added to repo Secrets → Actions

Check results in Actions tab → workflow run → console output. No artifacts are saved.

## Code Patterns & Key Modifications

### Environment Variables
Both sensitive values are loaded via dotenv:
```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const carRegistration = process.env.CAR_REGISTRATION || ''; 
const bookingId = process.env.BOOKING_ID || '';
```
**Never commit `.env.local` to git.** It's already in `.gitignore`.

### Timeouts & Waits
- Test has 120-second timeout (line 15: `test.setTimeout(120000)`)
- Between center checks: `waitForLoadState('networkidle')` + `waitForTimeout(3000)` to ensure dropdown data loads
- Pattern: Use `waitForLoadState` for network events, `waitForTimeout` for JS rendering delays

### Form Selectors
All selectors are **id-based** (e.g., `#rid`, `#btnSearchVehicle`, `#nctCentresDropdown`). This is fragile if NCT updates their DOM. If selectors break:
1. Inspect the NCT site with browser DevTools
2. Look for `id=` attributes first, then `name=`, then CSS classes
3. Update selectors and test locally with `--headed` flag

### Date Parsing
Dates from the NCT site come as `"07/05/2026 00:00:00"` (DD/MM/YYYY format). Line 112 uses regex to extract and parse:
```typescript
const dateMatch = dateValue.match(/(\d{2})\/(\d{2})\/(\d{4})/);
const slotDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
```
**Critical:** Month is 0-indexed in JavaScript—always use `parseInt(month) - 1`.

### Test Centers
Currently hardcoded in array (lines 19-25). To add/remove centers, just edit the array. The loop iterates through each one identically—no special logic per center.

### 14-Day Filter Window
Set on line 29. Currently `currentDate.getDate() + 14`. To change (e.g., 21 days):
```typescript
fourteenDaysFromNow.setDate(currentDate.getDate() + 21);
```
Update both the variable name and calculation if you want clarity.

## Debugging & Common Issues

| Issue | Solution |
|-------|----------|
| Selector timeout errors | NCT website DOM changed. Inspect with DevTools, update selector, test with `--headed` |
| "No CAR_REGISTRATION" or "No BOOKING_ID" | Ensure `.env.local` exists locally with both values, or both GitHub secrets are set in Secrets → Actions |
| Cookie banner blocks form | Try/catch handles this (lines 38-46). If it fails, NCT changed their cookie button selector. |
| Slots not parsing | Check NCT's date format hasn't changed. Debug with console.log around line 112 regex. |
| dotenv not loading | Run `npm install` to ensure `dotenv` is installed |

## Testing & Validation

- **No unit tests**—this is an e2e automation script
- **No mock data**—it always hits the real NCT website
- **CI validation:** The test passes if it completes without error, regardless of slots found (line 156: `expect(availableSlots).toBeDefined()`)
- To validate locally, run `--headed`, watch the browser, verify console output matches expected format

## Integration Points

- **GitHub Actions:** Reads both `CAR_REGISTRATION` and `BOOKING_ID` secrets, runs on schedule or manual trigger
- **External:** Only integrates with `ncts.ie` website via HTTP requests through Playwright
- **Dependencies:** `@playwright/test` and `dotenv`

## Quick Modification Checklist

When making changes, consider:
- [ ] Does the modification keep the linear flow intact?
- [ ] Are new selectors tested locally with `--headed` first?
- [ ] If adding env vars, update `.env.example` AND setup docs in README.md
- [ ] If adding test centers, add to the `centersToCheck` array
- [ ] If changing date window logic, test with dates near the boundary (e.g., today, 13 days out, 15 days out)
- [ ] Never hardcode `CAR_REGISTRATION` or `BOOKING_ID` in the test file
