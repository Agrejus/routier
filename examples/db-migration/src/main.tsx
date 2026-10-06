import { createRoot } from 'react-dom/client';
import { mountRoutierDevtools } from '@routier/devtools/production';
import { App } from './App';
import { removeLegacyInspectorDatabases } from './store';
import './styles.css';

mountRoutierDevtools();
void removeLegacyInspectorDatabases();

createRoot(document.getElementById('root')!).render(<App />);
