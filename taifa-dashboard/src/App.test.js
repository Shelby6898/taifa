import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Taifatech asset management landing page', () => {
  render(<App />);

  expect(
    screen.getByRole('heading', { name: /TAIFATECH/i })
  ).toBeInTheDocument();

  expect(
    screen.getByText('Multi-Tenant Asset Management Platform', { exact: true })
  ).toBeInTheDocument();

  expect(
    screen.getByRole('heading', { name: /Full Asset Lifecycle/i })
  ).toBeInTheDocument();
});
