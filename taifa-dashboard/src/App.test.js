import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Taifatech welcome page', () => {
  render(<App />);

  expect(
    screen.getByRole('heading', { name: /^taifatech$/i })
  ).toBeInTheDocument();

  expect(
    screen.getByText('Multi-Tenant Asset Management Platform', {
      exact: true,
    })
  ).toBeInTheDocument();

  expect(
    screen.getByRole('link', { name: /sign in here/i })
  ).toHaveAttribute('href', '/login');
});
