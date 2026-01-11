import { test, expect } from '@playwright/test';

test('3D Mode loads without crashing', async ({ page }) => {
  // 1. Go to the app
  console.log('Navigating to app...');
  await page.goto('/');

  // 2. Handle Intro
  console.log('Waiting for ENTER VOID button...');
  const enterBtn = page.getByText('ENTER VOID');
  await expect(enterBtn).toBeVisible();
  await enterBtn.click();

  // 3. Switch to 3D Mode
  console.log('Switching to 3D CUBE...');
  const switchBtn = page.getByRole('button', { name: /SWITCH TO 3D/i });
  await expect(switchBtn).toBeVisible();
  await switchBtn.click();

  // 4. Verification
  console.log('Verifying state...');
  
  // Check for Error Boundary text
  const errorHeading = page.getByRole('heading', { name: 'Something went wrong.' });
  if (await errorHeading.isVisible()) {
      const errorText = await page.getByRole('heading', { level: 2 }).textContent();
      const stackTrace = await page.locator('pre').textContent();
      console.error('CRITICAL ERROR FOUND:', errorText);
      console.error('Stack:', stackTrace);
      await page.screenshot({ path: 'error-screenshot.png' });
      throw new Error(`App crashed: ${errorText}`);
  }

  // Check for Infinite Loading
  const loading = page.getByText('Loading Quantum Matrix...');
  if (await loading.isVisible()) {
      console.log('State: Stuck in Loading...');
      // Wait a bit more to be sure
      await page.waitForTimeout(2000);
      if (await loading.isVisible()) {
          console.error('FAIL: Stuck in Suspense Loading state.');
          await page.screenshot({ path: 'loading-stuck.png' });
          throw new Error('Infinite Loading');
      }
  }

  // Check for "ENTER VR" OR "VR unsupported"
  const vrBtn = page.getByRole('button', { name: 'ENTER VR' });
  const unsupportedBtn = page.getByRole('button', { name: 'VR unsupported' });
  
  try {
      await expect(vrBtn.or(unsupportedBtn)).toBeVisible({ timeout: 5000 });
      console.log('SUCCESS: 3D Mode loaded.');
      
      // Perform Interaction Test (Click center of screen to toggle cell)
      // The canvas is centered.
      const viewport = page.viewportSize();
      if (viewport) {
          console.log('Performing Raycast Click Test...');
          await page.mouse.click(viewport.width / 2, viewport.height / 2);
          // Wait for haptic/state update (visuals)
          await page.waitForTimeout(500); 
          await page.screenshot({ path: 'interaction-check.png' });
          console.log('Interaction performed (Screenshot saved).');
      }

  } catch (e) {
      console.error('FAIL: Neither ENTER VR nor VR unsupported button found.');
      await page.screenshot({ path: 'fail-screenshot.png' });
      console.log('Current HTML Body:', await page.innerHTML('body'));
      throw e;
  }
});
