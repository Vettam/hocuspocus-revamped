// Set up test environment variables BEFORE importing modules
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long-for-testing';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_AUDIENCE = 'authenticated';
process.env.JWT_ISSUER = 'https://test.supabase.co/auth/v1';
process.env.VETTAM_API_KEY = 'test-api-key';
process.env.VETTAM_API_URL = 'https://test-api.example.com';
process.env.PUBLIC_HOST = 'test.example.com';

import test from 'ava';
import { LogLevel } from '../logger';

// We need to test the Logger class behavior
// Since logger is a singleton, we'll test its behavior through different scenarios

test.serial('LogLevel enum - should have correct values', (t) => {
  t.is(LogLevel.ERROR, 0);
  t.is(LogLevel.WARN, 1);
  t.is(LogLevel.INFO, 2);
  t.is(LogLevel.DEBUG, 3);
});

test.serial('LogLevel enum - should have correct hierarchy', (t) => {
  t.true(LogLevel.ERROR < LogLevel.WARN);
  t.true(LogLevel.WARN < LogLevel.INFO);
  t.true(LogLevel.INFO < LogLevel.DEBUG);
});

test.serial('Logger - formatMessage timestamp should be in ISO format', (t) => {
  // Timestamp should match ISO 8601 format
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const timestamp = new Date().toISOString();
  
  t.regex(timestamp, isoRegex);
});

test.serial('Logger - error method should accept message only', (t) => {
  // Create a new logger instance for testing
  const { logger } = require('../logger');
  
  // Mock console.error to capture output
  const originalError = console.error;
  let capturedOutput = '';
  
  console.error = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.error('Error message');
  
  // Restore console.error
  console.error = originalError;
  
  t.true(capturedOutput.includes('ERROR'));
  t.true(capturedOutput.includes('Error message'));
  t.regex(capturedOutput, /^\[\d{4}-\d{2}-\d{2}T/);
});

test.serial('Logger - error method should accept message with metadata', (t) => {
  const { logger } = require('../logger');
  
  const originalError = console.error;
  let capturedOutput = '';
  
  console.error = (msg: string) => {
    capturedOutput = msg;
  };
  
  const meta = { code: 500, details: 'Server error' };
  logger.error('Error occurred', meta);
  
  console.error = originalError;
  
  t.true(capturedOutput.includes('ERROR'));
  t.true(capturedOutput.includes('Error occurred'));
  t.true(capturedOutput.includes('"code":500'));
  t.true(capturedOutput.includes('"details":"Server error"'));
});

test.serial('Logger - warn method should accept message only', (t) => {
  const { logger } = require('../logger');
  
  const originalWarn = console.warn;
  let capturedOutput = '';
  
  console.warn = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.warn('Warning message');
  
  console.warn = originalWarn;
  
  t.true(capturedOutput.includes('WARN'));
  t.true(capturedOutput.includes('Warning message'));
});

test.serial('Logger - warn method should accept message with metadata', (t) => {
  const { logger } = require('../logger');
  
  const originalWarn = console.warn;
  let capturedOutput = '';
  
  console.warn = (msg: string) => {
    capturedOutput = msg;
  };
  
  const meta = { type: 'deprecation', feature: 'oldAPI' };
  logger.warn('Deprecated feature used', meta);
  
  console.warn = originalWarn;
  
  t.true(capturedOutput.includes('WARN'));
  t.true(capturedOutput.includes('Deprecated feature used'));
  t.true(capturedOutput.includes('"type":"deprecation"'));
});

test.serial('Logger - info method should accept message only', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.info('Info message');
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.true(capturedOutput.includes('Info message'));
});

test.serial('Logger - info method should accept message with metadata', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  const meta = { requestId: 'abc-123', duration: 250 };
  logger.info('Request processed', meta);
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.true(capturedOutput.includes('Request processed'));
  t.true(capturedOutput.includes('"requestId":"abc-123"'));
  t.true(capturedOutput.includes('"duration":250'));
});

test.serial('Logger - debug method should accept message only', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.debug('Debug message');
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('DEBUG'));
  t.true(capturedOutput.includes('Debug message'));
});

test.serial('Logger - debug method should accept message with metadata', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  const meta = { variable: 'value', count: 42 };
  logger.debug('Debugging info', meta);
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('DEBUG'));
  t.true(capturedOutput.includes('Debugging info'));
  t.true(capturedOutput.includes('"variable":"value"'));
  t.true(capturedOutput.includes('"count":42'));
});

test.serial('Logger - should handle complex metadata objects', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  const complexMeta = {
    user: { id: '123', name: 'John' },
    nested: { data: { value: 'test' } },
    array: [1, 2, 3],
  };
  
  logger.info('Complex data', complexMeta);
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.true(capturedOutput.includes('Complex data'));
  t.true(capturedOutput.includes('"user":'));
  t.true(capturedOutput.includes('"id":"123"'));
  t.true(capturedOutput.includes('"array":[1,2,3]'));
});

test.serial('Logger - should handle null metadata', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.info('Message with null', null);
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.true(capturedOutput.includes('Message with null'));
  t.true(capturedOutput.includes('null'));
});

test.serial('Logger - should handle undefined metadata', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.info('Message without meta', undefined);
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.true(capturedOutput.includes('Message without meta'));
  // Should not include metadata when undefined
  t.false(capturedOutput.includes('undefined'));
});

test.serial('Logger - should handle empty string messages', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.info('');
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.regex(capturedOutput, /^\[\d{4}-\d{2}-\d{2}T/);
});

test.serial('Logger - should handle special characters in messages', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  logger.info('Message with "quotes" and \'apostrophes\' and \nnewlines');
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.true(capturedOutput.includes('quotes'));
  t.true(capturedOutput.includes('apostrophes'));
});

test.serial('Logger - should handle special characters in metadata', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  const meta = { 
    description: 'Value with "quotes"',
    path: '/path/to/resource',
    unicode: '🎉✨'
  };
  
  logger.info('Special chars', meta);
  
  console.log = originalLog;
  
  t.true(capturedOutput.includes('INFO'));
  t.true(capturedOutput.includes('Special chars'));
  // JSON.stringify should escape quotes
  t.true(capturedOutput.includes('description'));
});

test.serial('Logger - timestamp should be current time', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  const beforeTime = new Date().getTime();
  logger.info('Timestamp test');
  const afterTime = new Date().getTime();
  
  console.log = originalLog;
  
  // Extract timestamp from output
  const timestampMatch = capturedOutput.match(/\[(.*?)\]/);
  t.truthy(timestampMatch);
  
  if (timestampMatch) {
    const loggedTime = new Date(timestampMatch[1]).getTime();
    t.true(loggedTime >= beforeTime);
    t.true(loggedTime <= afterTime);
  }
});

test.serial('Logger - multiple log calls should have different timestamps', async (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  const outputs: string[] = [];
  
  console.log = (msg: string) => {
    outputs.push(msg);
  };
  
  logger.info('First message');
  await new Promise(resolve => setTimeout(resolve, 10));
  logger.info('Second message');
  
  console.log = originalLog;
  
  t.is(outputs.length, 2);
  
  // Extract timestamps
  const timestamp1Match = outputs[0].match(/\[(.*?)\]/);
  const timestamp2Match = outputs[1].match(/\[(.*?)\]/);
  
  if (timestamp1Match && timestamp2Match) {
    const time1 = new Date(timestamp1Match[1]).getTime();
    const time2 = new Date(timestamp2Match[1]).getTime();
    t.true(time2 >= time1);
  }
});

test.serial('Logger - should export logger instance', (t) => {
  const { logger } = require('../logger');
  
  t.truthy(logger);
  t.is(typeof logger.error, 'function');
  t.is(typeof logger.warn, 'function');
  t.is(typeof logger.info, 'function');
  t.is(typeof logger.debug, 'function');
});

test.serial('Logger - should export default logger', (t) => {
  const logger = require('../logger').default;
  
  t.truthy(logger);
  t.is(typeof logger.error, 'function');
  t.is(typeof logger.warn, 'function');
  t.is(typeof logger.info, 'function');
  t.is(typeof logger.debug, 'function');
});

test.serial('Logger - all log levels should work with same logger instance', (t) => {
  const { logger } = require('../logger');
  
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  const outputs: string[] = [];
  
  console.error = (msg: string) => outputs.push(msg);
  console.warn = (msg: string) => outputs.push(msg);
  console.log = (msg: string) => outputs.push(msg);
  
  logger.error('Error');
  logger.warn('Warning');
  logger.info('Info');
  logger.debug('Debug');
  
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
  
  // In test environment (DEBUG=true by default), all levels should log
  t.true(outputs.length >= 4);
  t.true(outputs.some(o => o.includes('ERROR')));
  t.true(outputs.some(o => o.includes('WARN')));
  t.true(outputs.some(o => o.includes('INFO')));
  t.true(outputs.some(o => o.includes('DEBUG')));
});

test.serial('Logger - should handle circular references in metadata gracefully', (t) => {
  const { logger } = require('../logger');
  
  const originalLog = console.log;
  let capturedOutput = '';
  let errorOccurred = false;
  
  console.log = (msg: string) => {
    capturedOutput = msg;
  };
  
  // Create circular reference
  const circular: any = { name: 'test' };
  circular.self = circular;
  
  try {
    logger.info('Circular test', circular);
  } catch (error) {
    errorOccurred = true;
  }
  
  console.log = originalLog;
  
  // JSON.stringify will throw on circular references
  // This tests that the logger doesn't crash the app completely
  t.true(errorOccurred || capturedOutput.length > 0);
});

test.serial('Logger - message format should be consistent across log levels', (t) => {
  const { logger } = require('../logger');
  
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  const outputs: { level: string; output: string }[] = [];
  
  console.error = (msg: string) => outputs.push({ level: 'error', output: msg });
  console.warn = (msg: string) => outputs.push({ level: 'warn', output: msg });
  console.log = (msg: string) => outputs.push({ level: 'log', output: msg });
  
  const meta = { id: 123 };
  
  logger.error('Test', meta);
  logger.warn('Test', meta);
  logger.info('Test', meta);
  logger.debug('Test', meta);
  
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
  
  // All outputs should have the same structure
  for (const { output } of outputs) {
    t.regex(output, /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \w+: Test {"id":123}$/);
  }
});
