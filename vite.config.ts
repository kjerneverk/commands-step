import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            entryRoot: 'src',
            outDir: 'dist',
            exclude: ['**/*.test.ts'],
        }),
    ],
    build: {
        target: 'esnext',
        outDir: 'dist',
        lib: {
            entry: './src/index.ts',
            formats: ['es'],
            fileName: () => 'index.js',
        },
        rollupOptions: {
            external: [/^@kjerneverk\//, 'commander', 'chalk', 'node:path', 'node:fs/promises'],
            output: {
                format: 'esm',
                preserveModules: true,
                exports: 'named',
            },
        },
        minify: false,
        sourcemap: true,
    },
});
