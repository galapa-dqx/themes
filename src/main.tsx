import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { MantineProvider } from '@mantine/core'
// Mantine styles first so index.css (body font, etc.) wins ties.
import '@mantine/core/styles.css'
import './index.css'
import { router } from './router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Mantine styles only the unthemed chrome (top nav, studio tools);
        the themed preview renders no Mantine components. */}
    <MantineProvider defaultColorScheme="dark">
      <RouterProvider router={router} />
    </MantineProvider>
  </StrictMode>,
)
