import { render, screen } from '@testing-library/react';

import { App } from '@/app/App';
import { Button } from '@/components/Button';

describe('design system', () => {
  it('renders a Button with its label', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

describe('App shell', () => {
  it('mounts and renders navigation landmarks', () => {
    render(<App />);
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });
});
