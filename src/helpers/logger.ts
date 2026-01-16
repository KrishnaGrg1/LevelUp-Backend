/**
 * Simple Logger Utility
 * Provides consistent logging across the application
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogContext {
  userId?: string;
  communityId?: string;
  action?: string;
  ip?: string;
  [key: string]: any;
}

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = this.formatTimestamp();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails =
      error instanceof Error
        ? { error: error.message, stack: error.stack }
        : { error: String(error) };
    console.error(
      this.formatMessage('ERROR', message, { ...context, ...errorDetails })
    );
  }

  debug(message: string, context?: LogContext): void {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG === 'true'
    ) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  // Specific API logging methods
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, context);
  }

  apiSuccess(
    method: string,
    path: string,
    statusCode: number,
    context?: LogContext
  ): void {
    this.info(`API Success: ${method} ${path} - ${statusCode}`, context);
  }

  apiError(
    method: string,
    path: string,
    statusCode: number,
    error?: Error | unknown,
    context?: LogContext
  ): void {
    this.error(`API Error: ${method} ${path} - ${statusCode}`, error, context);
  }
}

// Export singleton instance
const logger = new Logger();
export default logger;
