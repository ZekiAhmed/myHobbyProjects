/**
 * @fileoverview Vitest Configuration
 * 
 * This file configures Vitest, the testing framework used for this project.
 * Vitest is a fast, Vite-native testing framework for JavaScript/TypeScript.
 * 
 * WHY VITEST?
 * - Fast (uses Vite's dev server for test execution)
 * - TypeScript support out of the box
 * - Compatible with Jest API (easy migration)
 * - Built-in coverage support
 * - Works great with React and Next.js
 * 
 * @see https://vitest.dev/config/
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Export Vitest configuration.
 * 
 * This configuration is used when running:
 * - `vitest` (watch mode)
 * - `vitest run` (single run)
 * - `vitest --coverage` (with coverage)
 */
export default defineConfig({
  /**
   * Vite plugins.
   * 
   * The React plugin enables:
   * - JSX transformation
   * - Fast refresh (hot reload in tests)
   * - React-specific optimizations
   */
  plugins: [react()],

  /**
   * Vitest-specific configuration.
   */
  test: {
    /**
     * Test environment.
     * 
     * 'jsdom' provides a browser-like environment:
     * - DOM APIs (document, window, etc.)
    * - Browser event handling
     * - Useful for testing React components
     * 
     * Alternative: 'node' for pure Node.js code (faster, no DOM)
     */
    environment: 'jsdom',

    /**
     * Enable global test APIs.
     * 
     * When true, you can use:
     * - describe(), it(), expect() without importing
     * - Matches Jest's default behavior
     * 
     * When false, you must import from 'vitest':
     * - import { describe, it, expect } from 'vitest'
     */
    globals: true,

    /**
     * Setup files to run before each test file.
     * 
     * These files are executed once before all tests in the file.
     * Useful for:
     * - Setting up test environment
     * - Mocking global objects
     * - Configuring test utilities
     * 
     * @see ./lib/__tests__/setup.ts for what's configured
     */
    setupFiles: ['./lib/__tests__/setup.ts'],
  },

  /**
   * Vite resolve configuration.
   */
  resolve: {
    /**
     * Path aliases.
     * 
     * The '@' alias maps to the project root.
     * This allows imports like:
     * - import { prisma } from '@/lib/db'
     * - import { auth } from '@/lib/auth'
     * 
     * Without this, you'd need relative paths:
     * - import { prisma } from '../../../lib/db'
     * 
     * This matches the tsconfig.json paths configuration.
     */
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
