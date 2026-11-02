import { render } from 'preact';
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './styles.css';
import { App } from './ui/App';
import { loadAll } from './app/store';
import { registerServiceWorker } from './app/offline';
import { listenForInstallPrompt } from './app/install';

// iOS Safari ignores user-scalable=no; stop pinch-zoom of the whole page (the editor has its own zoom).
document.addEventListener('gesturestart', (e) => e.preventDefault());

listenForInstallPrompt();
void loadAll();
render(<App />, document.getElementById('app')!);
registerServiceWorker();
