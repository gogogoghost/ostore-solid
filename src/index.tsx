/* @refresh reload */
import "uno.css"
import './index.css';
import { ErrorBoundary } from 'solid-js';
import { render } from 'solid-js/web';
import { Router, Route } from "@solidjs/router";

import Index from './routes/Index'
import { updateInstalledAppList } from "./store";
import { detectBackend } from "./api";
import SelectFile from "./routes/SelectFile";

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

detectBackend().then(updateInstalledAppList);

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
