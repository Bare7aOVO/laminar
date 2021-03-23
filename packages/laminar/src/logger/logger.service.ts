/* eslint-disable @typescript-eslint/no-explicit-any */
import { Service } from '../';
import { LoggerLike, LoggerMetadata } from './types';
import type { Logger } from 'winston';

/**
 * A {@link Service} wrapper for a winston logger instance.
 * Forwards all calls to `debug`, `info`, `warn`, `error` to the winston instance.
 *
 * Calls logger.close() on stop
 */
export class LoggerService implements Service, LoggerLike {
  constructor(public source: Logger) {}

  debug(message: any, metadata?: LoggerMetadata): void {
    this.source.log({ level: 'debug', message, metadata });
  }

  info(message: any, metadata?: LoggerMetadata): void {
    this.source.log({ level: 'info', message, metadata });
  }

  warn(message: any, metadata?: LoggerMetadata): void {
    this.source.log({ level: 'warn', message, metadata });
  }

  error(message: any, metadata?: LoggerMetadata): void {
    this.source.log({ level: 'error', message, metadata });
  }

  async start(): Promise<this> {
    return this;
  }

  async stop(): Promise<this> {
    this.source.close();
    return this;
  }

  describe(): string {
    return '📜 Winston Logger';
  }
}
