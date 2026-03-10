import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from '@rspack/cli';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    entry: './src/index.ts',
    mode: 'production',
    target: 'node',
    output: {
        filename: 'index.js',
        path: resolve(__dirname, "dist"),
        library: {
            type: 'commonjs2'
        }
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    }
                ]
            }
        ]
    },
    externals: {
        '@routier/core': 'commonjs @routier/core',
        '@routier/datastore': 'commonjs @routier/datastore',
        'pg': 'commonjs pg',
        'pg-native': 'commonjs pg-native'
    }
});
