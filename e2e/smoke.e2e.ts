import { expect, test } from '@playwright/test';

test('the app boots and asks for setup or sign-in', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/(setup|login)/);
	await expect(page.getByRole('button')).toBeVisible();
});
