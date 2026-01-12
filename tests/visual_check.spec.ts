import { test, expect } from '@playwright/test';

test('Visual Check: Edge and Corner Rendering', async ({ page }) => {
  // 1. Go to the app
  await page.goto('/');

  // 2. Enter Void
  await page.getByText('ENTER VOID').click();

  // 3. Switch to 3D
  await page.getByRole('button', { name: /SWITCH TO 3D/i }).click();

  // 4. Wait for 3D load
  await expect(page.getByRole('button', { name: 'VR unsupported' }).or(page.getByRole('button', { name: 'ENTER VR' }))).toBeVisible({ timeout: 10000 });

  // 5. Click RANDOM to populate grid
  await page.getByRole('button', { name: 'RANDOM' }).click();

  // 6. Wait a moment for rendering
  await page.waitForTimeout(1000);

  // 7. Take screenshot
  // Note: We can't easily rotate the camera to a perfect edge view in this headless/automated test 
  // without injecting code to manipulate the Three.js camera. 
  // However, the default view usually shows some perspective.
  
  await page.screenshot({ path: 'visual-check-edges.png' });
  console.log('Screenshot saved to visual-check-edges.png');
});
