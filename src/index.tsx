/* @refresh reload */
import "uno.css"
import './index.css';
import { ErrorBoundary } from 'solid-js';
import { render } from 'solid-js/web';
import { Router, Route } from "@solidjs/router";

import Index from './routes/Index'
import { updateInstalledAppList } from "./store";
import { detectInstallMode } from "./api";
import { checkOwnUpdate, errorText } from "./api/appsmanager";
import SelectFile from "./routes/SelectFile";

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

// Restarting the app is the way to re-detect: probe every backend on launch.
updateInstalledAppList();
detectInstallMode(true).catch(error =>
  console.warn('[ostore] install mode detection failed:', error));

// Check for our own update after startup. A failure leaves the store usable;
// the next launch can retry when its installed update server is reachable.
if (!import.meta.env.DEV &&
    (location.hostname === 'ostore.localhost' || location.protocol === 'app:')) {
  setTimeout(() => {
    checkOwnUpdate().catch(error =>
      console.warn('[ostore] self-update check failed:', errorText(error)))
  }, 2000)
}

render(() => {
  document.addEventListener('keydown', (evt) => {
    if (evt.key == "Backspace") {
      if (history.state?._depth > 0) {
        history.back()
        evt.preventDefault()
      }
    }
  })
  return (<ErrorBoundary fallback={(err) => {
    console.error(err)
    const message = (err && (err.message || String(err))) || 'unknown error'
    queueMicrotask(() => alert('OStore error: ' + message))
    return <div class="p-[8px] text-[13px]">OStore error: {message}</div>
  }}>
    <Router>
      <Route path={['/', '/index.html']} component={Index} />
      <Route path='/SelectFile' component={SelectFile} />
    </Router>
  </ErrorBoundary>)
}, root!);
