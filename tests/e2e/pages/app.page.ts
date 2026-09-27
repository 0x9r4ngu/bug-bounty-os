import { type Page, type Locator, expect } from '@playwright/test';

/**
 * App shell: sidebar nav, topbar, command palette, toasts.
 *
 * Selector note: bounty/os exposes stable test hooks as `data-*` action attributes and
 * element ids (documented in .agents/qa-project-context.md → Conventions). User-facing
 * getByRole/getByText is used wherever an accessible name exists; data-attribute and id
 * locators are the justified exception for rows, checkboxes, and unlabeled modal inputs.
 */
export class AppPage {
  constructor(readonly page: Page) {}

  async goto(route = 'dashboard'): Promise<void> {
    await this.page.goto(`/#/${route}`);
    await this.ready();
  }

  async ready(): Promise<void> {
    await expect(this.page.locator('.sidebar')).toBeVisible();
    await expect(this.page.locator('.main')).toBeVisible();
  }

  nav(name: string | RegExp): Locator {
    // scope to the sidebar so dashboard feed links named "…findings…" don't collide
    return this.page.locator('#sidebar').getByRole('link', { name });
  }

  async navigate(name: string | RegExp): Promise<void> {
    await this.nav(name).click();
  }

  get newReportButton(): Locator {
    return this.page.getByRole('button', { name: /New report/ });
  }

  get commandButton(): Locator {
    return this.page.getByRole('button', { name: /Search or run a command/ });
  }

  get toast(): Locator {
    return this.page.locator('#toasts .toast');
  }

  /** A specific toast by text — robust when several toasts are stacked. */
  toastWith(text: string | RegExp): Locator {
    return this.page.locator('#toasts .toast', { hasText: text });
  }

  activeNav(): Locator {
    return this.page.locator('.nav-item.active');
  }

  /** Opens the Ctrl+K command palette via the topbar button. */
  async openCommandPalette(): Promise<void> {
    await this.commandButton.click();
    await expect(this.page.locator('#cmdk-input')).toBeVisible();
  }
}
