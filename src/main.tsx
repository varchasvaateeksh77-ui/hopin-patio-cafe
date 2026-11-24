import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {isQuotaErrorMessage} from './utils/scrollChoreography';

// Tier 1 Google Maps Platform quota & auth failure listener
if (typeof window !== 'undefined') {
  (window as unknown as {gm_authFailure?: () => void}).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (isQuotaErrorMessage(msg)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };
}

createRoot(document.getElementById('root')!).render(<App />);
