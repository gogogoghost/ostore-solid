/* @refresh reload */
import "uno.css"
import './index.css';
import { render } from 'solid-js/web';
import { Router, Route } from "@solidjs/router";

import Index from './routes/Index'
import { updateInstalledAppList } from "./store";
import SelectFile from "./routes/SelectFile";

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

updateInstalledAppList();

render(() => {
  document.addEventListener('keydown', (evt) => {
    if (evt.key == "Backspace") {
      if (history.state?._depth > 0) {
        history.back()
        evt.preventDefault()
      }
    }
  })
  return (<Router>
    <Route path={['/', '/index.html']} component={Index} />
    <Route path='/SelectFile' component={SelectFile} />
  </Router>)
}, root!);
