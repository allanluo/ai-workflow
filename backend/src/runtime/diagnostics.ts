import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface DiagnosticsLogger {
  debug(category: string, message: string, data?: Record<string, unknown>): void;
  info(category: string, message: string, data?: Record<string, unknown>): void;
  warn(category: string, message: string, data?: Record<string, unknown>): void;
  error(category: string, message: string, data?: Record<string, unknown>): void;
}

function formatLogEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}`;
  if (entry.data && Object.keys(entry.data).length > 0) {
    return `${base} ${JSON.stringify(entry.data)}`;
  }
  return base;
}

export function createFileLogger(logFilePath: string): DiagnosticsLogger {
  const dir = dirname(logFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return {
    debug(category, message, data) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'debug',
        category,
        message,
        data,
      };
      appendFileSync(logFilePath, formatLogEntry(entry) + '\n');
    },
    info(category, message, data) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        category,
        message,
        data,
      };
      appendFileSync(logFilePath, formatLogEntry(entry) + '\n');
    },
    warn(category, message, data) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        category,
        message,
        data,
      };
      appendFileSync(logFilePath, formatLogEntry(entry) + '\n');
    },
    error(category, message, data) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        category,
        message,
        data,
      };
      appendFileSync(logFilePath, formatLogEntry(entry) + '\n');
    },
  };
}

export function createConsoleLogger(): DiagnosticsLogger {
  return {
    debug(category, message, data) {
      console.debug(`[${category}] ${message}`, data ?? '');
    },
    info(category, message, data) {
      console.info(`[${category}] ${message}`, data ?? '');
    },
    warn(category, message, data) {
      console.warn(`[${category}] ${message}`, data ?? '');
    },
    error(category, message, data) {
      console.error(`[${category}] ${message}`, data ?? '');
    },
  };
}

export function createDiagnosticsLogger(logFilePath?: string): DiagnosticsLogger {
  if (logFilePath) {
    return createFileLogger(logFilePath);
  }
  return createConsoleLogger();
}
