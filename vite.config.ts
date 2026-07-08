import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/node_modules', '**/dist', '.idea', '.git', '.cache','**/lib', '**/out'],
  },
  build: {
    lib: {
      entry: resolve( __dirname, 'src/index.ts' ),
      name: 'entropic-bond-local-storage',
      fileName: 'entropic-bond-local-storage'
    },
    sourcemap: true,
    outDir: 'lib',
  },
  plugins: [
    dts({ tsconfigPath: './tsconfig.json' })
  ]
})
