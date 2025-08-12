import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            'routier': resolve(__dirname, '../routier/src'),
            'routier-core': resolve(__dirname, '../core/src'),
            'routier-plugin-memory': resolve(__dirname, '../plugins/memory/src'),
            'routier-plugin-local-storage': resolve(__dirname, '../plugins/local-storage/src')
        }
    },
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
})
