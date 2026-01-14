# NCT Booking Checker

Automated Playwright script to check NCT (National Car Testing) booking availability across multiple test centers in Ireland every 30 minutes.

## Features

- ✅ Automated form navigation and data entry
- ✅ Checks 5 test centers: Greenhills, Naas, Fonthill, Deansgrange, Navan
- ✅ Filters slots within 14 days from current date
- ✅ Console output with results
- ✅ Runs automatically every 30 minutes via GitHub Actions
- ✅ Manual trigger option

## Quick Start

### 1. Setup

```bash
npm install
```

### 2. Configure

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your car registration and booking ID:
```env
CAR_REGISTRATION=your-car-registration
BOOKING_ID=your-booking-id
```

### 3. Run Locally

```bash
npx playwright test playwright/nct-booking-checker.spec.ts --headed
```

Or headless:
```bash
npx playwright test playwright/nct-booking-checker.spec.ts
```

## GitHub Actions Setup

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/nct-booking-checker.git
git branch -M main
git push -u origin main
```

### 2. Add GitHub Secrets

1. Go to your repository on GitHub
2. Settings → Secrets and variables → Actions
3. Create two secrets:
   - `CAR_REGISTRATION` = your car registration
   - `BOOKING_ID` = your NCT booking ID

### 3. View Results

- Go to **Actions** tab
- Click on the workflow run to see console output
- Runs automatically every 30 minutes
- Can manually trigger anytime

## Available Slots Output

When slots are found within 14 days:
```
🎉 Available slots found within 14 days:
  - Greenhills (Exit 11,M50): Thu Jan 23 2026
  - Naas: Fri Jan 24 2026
```

## Test Centers

- Greenhills (Exit 11, M50)
- Naas
- Fonthill
- Deansgrange
- Navan

## Customization

### Change Time Window

Edit `playwright/nct-booking-checker.spec.ts` line 29:
```typescript
fourteenDaysFromNow.setDate(currentDate.getDate() + 21); // Check 21 days instead
```

### Add More Centers

Edit `centersToCheck` array in the script (lines 19-25).

### Change Schedule

Edit `.github/workflows/nct-checker.yml` line 5:
```yaml
cron: '0 * * * *'  # Every hour
cron: '0 9 * * *'  # Daily at 9 AM
```

## Troubleshooting

### Selectors Not Found

The NCT website may update. Run locally with `--headed` to debug:
```bash
npx playwright test playwright/nct-booking-checker.spec.ts --headed --debug
```

### GitHub Actions Fails

Check the workflow run logs in the Actions tab for error details.

### Environment Variables Not Found

Ensure both `CAR_REGISTRATION` and `BOOKING_ID` are set:
- **Locally:** in `.env.local` file
- **GitHub Actions:** in repository Secrets → Actions

## License

MIT
