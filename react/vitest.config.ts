import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            'routier': resolve(__dirname, '../routier/src'),
            '@routier/core': resolve(__dirname, '../core/src'),
            'routier-plugin-memory': resolve(__dirname, '../plugins/memory/src'),
            'routier-plugin-local-storage': resolve(__dirname, '../plugins/local-storage/src')
        }
    }
})
