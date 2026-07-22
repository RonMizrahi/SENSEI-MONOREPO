import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createTestQueryClient } from '../src/query/queryClient';
import { AppStoreProvider } from '../src/store/AppStore';

/** Isolated QueryClient for hook/unit tests that don't use AppStoreProvider. */
export function QueryTestProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => createTestQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function renderWithQuery(ui: React.ReactElement) {
  return render(<QueryTestProviders>{ui}</QueryTestProviders>);
}

/** App + store + a fresh query client (clears cache between mounts in a file). */
export function renderApp(ui: React.ReactElement) {
  return render(<AppStoreProvider>{ui}</AppStoreProvider>);
}
