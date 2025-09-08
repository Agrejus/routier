import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        projects: [
            'core/vitest.config.ts',
            'datastore/vitest.config.ts',
            'react/vitest.config.ts',
            'plugins/*/vitest.config.ts'
        ],
    },
})