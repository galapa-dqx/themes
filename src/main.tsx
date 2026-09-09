import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import App, { EditorIndex, SettingsRoute } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route path="/editor" element={<EditorIndex />} />
          <Route path="/editor/settings" element={<SettingsRoute />} />
          <Route
            path="/editor/:id"
            element={<Navigate to="controls" replace />}
          />
          <Route path="/editor/:id/:section/:item?" element={<App />} />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
);
