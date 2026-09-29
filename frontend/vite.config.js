/**
 * @file vite.config.js
 * @description Vite configuration file for the React frontend application.
 * Enables React fast refresh and the Tailwind CSS v4 Vite compiler plugin.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
});