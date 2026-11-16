import React from 'react';
import ReactDOM from 'react-dom/client';
import { MiniPlayerWindow } from './components/MiniPlayerWindow';
import './styles/mini.css';

ReactDOM.createRoot(document.getElementById('mini-root') as HTMLElement).render(
  <React.StrictMode>
    <MiniPlayerWindow />
  </React.StrictMode>
);
