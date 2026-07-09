import { AppProviders } from './providers';
import { AppRouter } from './AppRouter';

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
