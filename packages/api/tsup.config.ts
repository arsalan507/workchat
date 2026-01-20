import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'node20',
})
