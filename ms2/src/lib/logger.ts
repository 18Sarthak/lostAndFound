// src/lib/logger.ts
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino(
  env.NODE_ENV === 'development'
    ? { level: 'debug', transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: 'info' },
);
