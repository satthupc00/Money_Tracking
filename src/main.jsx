import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { isElectron, initBackButton } from './platform.js';

if (isElectron()) document.documentElement.classList.add('electron');
initBackButton();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
