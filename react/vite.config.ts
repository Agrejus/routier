import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src')
        }
    },
    server: {
        port: 3000,
        open: true
    },
    build: {
        sourcemap: true,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: '@routier/react',
            formats: ['es', 'cjs'],
            // `.cjs` rather than `index.cjs.js`: this package sets `type: "module"`, so Node
            // reads any `.js` as ESM and `require()` hit "exports is not defined".
            fileName: (format) => (format === 'cjs' ? 'index.cjs' : 'index.js')
        },
        rollupOptions: {
            external: ['react', 'react-dom', '@routier/core', 'routier'],
        },
        outDir: 'dist'
    }
})
