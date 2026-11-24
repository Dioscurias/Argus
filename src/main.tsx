import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter-tight/latin-400.css';
import '@fontsource/inter-tight/latin-600.css';
import '@fontsource/inter-tight/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
