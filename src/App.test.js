import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import queryClient from './lib/queryClient';

jest.mock('./config/apiClient', () => ({
  __esModule: true,
  API_BASE: 'https://incident-backend-rzmq.onrender.com',
  default: {
    get: () => Promise.reject(new Error('Unauthenticated')),
    post: () => Promise.resolve({ data: {} }),
    put: () => Promise.resolve({ data: {} }),
    delete: () => Promise.resolve({ data: {} }),
  },
}));

test('renders the staff login screen for unauthenticated users', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );

  expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
});
