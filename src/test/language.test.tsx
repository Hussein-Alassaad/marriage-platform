import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import i18n from '@/i18n';
import { App } from '@/app/App';

afterEach(async () => {
  window.localStorage.clear();
  await i18n.changeLanguage('en');
});

describe('language & direction', () => {
  it('starts in English / LTR and flips to Arabic / RTL via the switcher', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    await user.click(screen.getByRole('button', { name: /switch language/i }));

    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
