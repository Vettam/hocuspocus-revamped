export default {
  files: [
    'src/**/*.test.ts',
    'src/**/__tests__/*.ts'
  ],
  extensions: ['ts'],
  require: ['ts-node/register'],
  timeout: '60s',
  concurrency: 5,
  serial: false,
  verbose: true,
  environmentVariables: {
    NODE_ENV: 'test'
  }
};
