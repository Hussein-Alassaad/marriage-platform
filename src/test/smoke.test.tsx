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
  it('redirects unauthenticated visitors to the sign-in screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});
