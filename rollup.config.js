// import json from 'rollup-plugin-json';
// import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { uglify } from "rollup-plugin-uglify";

export default [{
  input: 'src/index.js',
  output: {
    file: 'dist/errorWatch.esm.js',
    format: 'esm'
  },
}, {
  input: 'src/index.js',
  output: {
    // file: 'bundle.es.js',
    entryFileNames: 'errorWatch.js',
    // chunkFileNames: '[name].es[hash].js',
    dir: 'dist',
    name: 'ErrorWatch',
    format: 'umd'
  },
  plugins: [
    // json(),
    // resolve(),
    babel(),
    // uglify(),
  ]
}, {
  input: 'src/index.js',
  output: {
    // file: 'bundle.es.js',
    entryFileNames: 'errorWatch.min.js',
    // chunkFileNames: '[name].es[hash].js',
    dir: 'dist',
    name: 'ErrorWatch',
    format: 'umd',
      sourcemap: true,
      sourcemapFile: 'errorWatch.min.js.map',
  },
  plugins: [
    // json(),
    // resolve(),
    babel(),
    uglify(),
  ]
}]
