import { createRoot } from 'react-dom/client';
import { mountRoutierDevtools } from '@routier/devtools/production';
import { App } from './App';
import './styles.css';

mountRoutierDevtools();

createRoot(document.getElementById('root')!).render(<App />);
