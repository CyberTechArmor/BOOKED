import pino from 'pino';
import { getConfig } from '../config/index.js';

let logger: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (logger) {
    return logger;
  }

  const config = getConfig();

  logger = pino({
    level: config.LOG_LEVEL,
    transport:
      config.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return logger;
}

export function createChildLogger(bindings: pino.Bindings): pino.Logger {
  return getLogger().child(bindings);
}
