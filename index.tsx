import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { COMPANY_CONFIG } from './config';

// Mise à jour dynamique du titre
document.title = `${COMPANY_CONFIG.name} Manager`;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);