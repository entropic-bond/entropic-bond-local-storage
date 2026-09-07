import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/node_modules', '**/dist', '.idea', '.git', '.cache','**/lib', '**/out'],
  },
  build: {
    lib: {
			entry: import.meta.dirname + '/src/index.ts',
      name: 'entropic-bond-local-storage',
      fileName: 'entropic-bond-local-storage'
    },
    sourcemap: true,
    outDir: 'lib',
  }
})
