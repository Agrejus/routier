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
              // Rspack ships this loader with its native binding. Using ts-loader here
              // unnecessarily requires webpack itself to be installed as a peer and makes
              // an otherwise-Rspack-only package fail to build in a clean workspace.
              loader: 'builtin:swc-loader',
              options: {
                  jsc: {
                      parser: { syntax: 'typescript' },
                      target: 'es2022',
                  },
              },
          }
        ]
      }
    ]
  },
  externals: {
    '@routier/core': 'commonjs @routier/core',
    '@routier/datastore': 'commonjs @routier/datastore',
    'mysql2': 'commonjs mysql2',
    'cardinal': 'commonjs cardinal'
  }
});
