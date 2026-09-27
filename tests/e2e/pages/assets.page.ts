import { type Page, type Locator } from '@playwright/test';

export class AssetsPage {
  constructor(readonly page: Page) {}

  get programSwitcher(): Locator {
    return this.page.locator('.prog-switch');
  }

  async selectProgram(name: string): Promise<void> {
    await this.programSwitcher.selectOption({ label: name });
  }

  assets(): Locator {
    return this.page.locator('.tree-asset');
  }

  firstToggle(): Locator {
    return this.page.locator('.tree-head[data-toggle]').first();
  }

  firstSubList(): Locator {
    return this.page.locator('[data-sublist]').first();
  }

  get addAssetButton(): Locator {
    return this.page.locator('[data-addasset]').first();
  }
}
