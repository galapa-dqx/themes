import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import App from './App';

// ponytail: placeholder theme id until themes are persisted; /editor will become a picker.
const DEFAULT_THEME = 'crimson-night';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route path="/editor" element={<Navigate to={`/editor/${DEFAULT_THEME}/controls`} replace />} />
          <Route path="/editor/:id" element={<Navigate to="controls" replace />} />
          <Route path="/editor/:id/:section" element={<App />} />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
);
