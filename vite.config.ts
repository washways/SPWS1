// vite.config.js (or .ts)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Change base: '/' to base: './'
  base: './', 
  plugins: [react()],
})