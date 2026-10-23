import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import useInactivityLogout from './useInactivityLogout';

function ProtectedPage() {
  useInactivityLogout();
  return <h1>Protected Dashboard</h1>;
}

function LoginPage() {
  return <h1>Login Page</h1>;
}

function renderProtectedPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<ProtectedPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ id: 'test-user' }));
});

afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('logs out after 15 minutes of inactivity', () => {
  renderProtectedPage();

  expect(
    screen.getByRole('heading', { name: 'Protected Dashboard' })
  ).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(15 * 60 * 1000);
  });

  expect(
    screen.getByRole('heading', { name: 'Login Page' })
  ).toBeInTheDocument();

  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('user')).toBeNull();
});

test('resets inactivity timeout when the user is active', () => {
  renderProtectedPage();

  act(() => {
    jest.advanceTimersByTime(14 * 60 * 1000);
  });

  act(() => {
    window.dispatchEvent(new Event('mousemove'));
  });

  act(() => {
    jest.advanceTimersByTime(14 * 60 * 1000);
  });

  expect(
    screen.getByRole('heading', { name: 'Protected Dashboard' })
  ).toBeInTheDocument();

  act(() => {
    jest.advanceTimersByTime(60 * 1000);
  });

  expect(
    screen.getByRole('heading', { name: 'Login Page' })
  ).toBeInTheDocument();
});
