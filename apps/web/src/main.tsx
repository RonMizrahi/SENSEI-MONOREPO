import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import { AppStoreProvider } from './store/AppStore';
import App from './App';

// One-line, non-PII boot log: correlates a client with its deployed release when
// diagnosing stale-cache / chunk-mismatch reports. `typeof` guard: the constant
// is injected by Vite `define`; tests importing modules outside Vite won't have it.
if (typeof __APP_VERSION__ !== 'undefined') console.info('[sensei] v' + __APP_VERSION__);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  </React.StrictMode>,
);
