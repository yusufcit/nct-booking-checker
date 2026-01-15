import { test, expect, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Silent env loader: .env.local (top priority) → .env → playwright/.env
const envFiles = [
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '.env'),
];
for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    const parsed = dotenv.parse(fs.readFileSync(envPath));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

interface AvailableSlot {
  center: string;
  date: string;
}

async function notifySlack(slots: AvailableSlot[]) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
  
  console.log(`[Slack] webhook=${!!webhook}, slots=${slots.length}, isGitHubActions=${isGitHubActions}`);
  
  if (!webhook || slots.length === 0 || !isGitHubActions) {
    console.log('[Slack] Skipping notification');
    return;
  }
  
  const text = [
    '🎉 NCT slots within 14 days:',
    ...slots.map(s => `• ${s.center}: ${s.date}`)
  ].join('\n');

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (response.ok) {
      console.log('[Slack] ✓ Notification sent successfully');
    } else {
      console.log(`[Slack] ✗ Failed with status ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[Slack] ✗ Error sending notification:', error);
  }
}

test.describe('NCT Booking Availability Checker', () => {
  test('Check NCT booking availability for multiple centers', async ({ page }) => {
    test.setTimeout(120000); // Increase timeout to 2 minutes
    const carRegistration = process.env.CAR_REGISTRATION || ''; 
    const bookingId = process.env.BOOKING_ID || '';

    if (!carRegistration || !bookingId) {
      throw new Error('Missing CAR_REGISTRATION or BOOKING_ID in environment variables.');
    }
    
    const centersToCheck = [
      'Greenhills (Exit 11,M50)',
      'Naas',
      'Fonthill',
      'Deansgrange',
      'Navan'
    ];
    
    const availableSlots: AvailableSlot[] = [];
    const currentDate = new Date();
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(currentDate.getDate() + 14);

    // Step 1: Go to NCT website
    await page.goto('https://www.ncts.ie/');
    await page.waitForLoadState('networkidle');

    // Step 2: Accept cookie policy
    try {
      const cookieButton = page.locator('button:has-text("Accept"), button:has-text("accept")').first();
      if (await cookieButton.isVisible({ timeout: 5000 })) {
        await cookieButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (error) {
      console.log('No cookie banner found or already accepted');
    }

    // Step 3: Enter car registration number
    await page.locator('#rid').fill(carRegistration);
    
    // Step 4: Click submit button
    await page.locator('#btnSearchVehicle').click();
    await page.waitForLoadState('networkidle');

    // Step 5: Check the first checkbox
    await page.locator('#agreeChk').check();
    
    // Step 6: Check the privacy checkbox
    await page.locator('#chkPrivacyRead').check();
    
    // Step 7: Click Yes button to confirm vehicle
    await page.locator('#confirmVehicleYes').click();
    await page.waitForLoadState('networkidle');

    // Step 8: Click reschedule booking button
    await page.locator('#confirmManageBookingYes').click();
    await page.waitForLoadState('networkidle');

    // Step 9: Enter booking ID
    await page.locator('#RescheduleManagedBookingId').fill(bookingId);
    
    // Step 10: Click Reschedule Booking button
    await page.locator('.btn.btn-nct-yellow.btn-block').click();
    await page.waitForLoadState('networkidle');

    // Step 11: Click Yes button to confirm booking
    await page.locator('#confirmBookingYes').click();
    await page.waitForLoadState('networkidle');

    // Step 12: Click dropdown to show more stations
    await page.locator('#showMoreStations').click();
    await page.waitForTimeout(2000);

    // Wait for dropdown to be visible
    await page.locator('#nctCentresDropdown').waitFor({ state: 'visible' });

    // Steps 13-16: Loop through each center and check availability
    for (const centerName of centersToCheck) {
      console.log(`\nChecking availability for: ${centerName}`);
      
      try {
        // Select the center from the dropdown
        await page.selectOption('#nctCentresDropdown', { label: centerName });
        console.log(`  ✓ Selected center from dropdown`);
        
        // Wait for page to load after selection (form auto-submits)
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // Wait 3 seconds for dates to load

        // Check for available booking slots - they're radio buttons with name="SelectedBookingDay"
        const dateInputs = page.locator('input[name="SelectedBookingDay"]');
        const dateCount = await dateInputs.count();
        console.log(`  Found ${dateCount} available date slots`);
        
        if (dateCount > 0) {
          // Check the first available date
          const firstDateInput = dateInputs.first();
          const dateValue = await firstDateInput.getAttribute('data-value');
          
          if (dateValue) {
            console.log(`  First available slot: ${dateValue}`);
            
            // Parse date format: "07/05/2026 00:00:00" (DD/MM/YYYY)
            const dateMatch = dateValue.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            
            if (dateMatch) {
              const [_, day, month, year] = dateMatch;
              const slotDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              
              // Check if date is within 14 days
              if (slotDate <= fourteenDaysFromNow) {
                console.log(`  ✓ Found slot within 14 days: ${slotDate.toDateString()}`);
                availableSlots.push({
                  center: centerName,
                  date: slotDate.toDateString()
                });
              } else {
                const daysAway = Math.ceil((slotDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                console.log(`  ✗ Slot is ${daysAway} days away: ${slotDate.toDateString()}`);
              }
            }
          }
        } else {
          console.log(`  ℹ️  No available slots found for this center`);
        }

        // Go back to show more stations dropdown for next center
        await page.locator('#showMoreStations').click();
        await page.waitForTimeout(1000);
        
      } catch (error) {
        console.error(`  ✗ Error checking ${centerName}:`, error);
      }
    }

    // Step 17: Print results to console
    if (availableSlots.length > 0) {
      console.log('\n🎉 Available slots found within 14 days:');
      availableSlots.forEach(slot => {
        console.log(`  - ${slot.center}: ${slot.date}`);
      });
      console.log('\n✓ Check complete - slots saved above');
      await notifySlack(availableSlots);
    } else {
      console.log('\n❌ No slots available within 14 days from current date.');
    }

    // Expect at least to have completed the flow
    expect(availableSlots).toBeDefined();
  });
});
