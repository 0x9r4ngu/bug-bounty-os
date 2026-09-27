import { type Page, type Locator } from '@playwright/test';

export class ProgramsPage {
  constructor(readonly page: Page) {}

  rows(): Locator {
    return this.page.locator('[data-open]');
  }

  row(name: string | RegExp): Locator {
    return this.page.locator('[data-open]', { hasText: name });
  }

  filterChip(id: 'all' | 'public' | 'private' | 'watched'): Locator {
    return this.page.locator(`[data-filter="${id}"]`);
  }

  get newProgramButton(): Locator {
    return this.page.getByRole('button', { name: /New program/ });
  }

  // ---- full-page program detail ----
  get programTitle(): Locator {
    return this.page.locator('.prog-title');
  }

  programTab(id: 'scope' | 'notes' | 'timeline'): Locator {
    return this.page.locator(`[data-ptab="${id}"]`);
  }

  get notesEditor(): Locator {
    return this.page.locator('#prog-notes');
  }

  get backToProgramsLink(): Locator {
    return this.page.locator('#crumb a', { hasText: 'Programs' });
  }

  // ---- new program modal ----
  async fillNewProgram(fields: { name: string; platform?: string; assets?: string }): Promise<void> {
    await this.page.locator('#np-name').fill(fields.name);
    if (fields.platform) await this.page.locator('#np-plat').selectOption(fields.platform);
    if (fields.assets) await this.page.locator('#np-assets').fill(fields.assets);
    await this.page.locator('#np-save').click();
  }
}
