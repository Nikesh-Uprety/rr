/**
 * Centralized logging service
 * Replaces raw console.log/error calls throughout the app
 * Provides structured logging with levels and context
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  source?: string;
  userId?: string;
  requestId?: string;
  timestamp?: string;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error | unknown;
  metadata?: Record<string, unknown>;
}

class Logger {
  private isDev = process.env.NODE_ENV === "development";

  private formatTime(): string {
    const now = new Date();
    return now.toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDev) return true;
    // In production, skip debug logs
    return level !== "debug";
  }

  private formatLog(entry: LogEntry): string {
    const timestamp = entry.context?.timestamp || this.formatTime();
    const source = entry.context?.source || "APP";
    const level = entry.level.toUpperCase();
    
    let message = `[${timestamp}] [${level}] [${source}]`;
    
    if (entry.context?.userId) {
      message += ` [User: ${entry.context.userId}]`;
    }
    if (entry.context?.requestId) {
      message += ` [Request: ${entry.context.requestId}]`;
    }
    
    message += ` ${entry.message}`;
    
    if (entry.error) {
      const err = entry.error instanceof Error ? entry.error : new Error(String(entry.error));
      message += `\nError: ${err.message}\n${err.stack}`;
    }
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += `\nMetadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }
    
    return message;
  }

  log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error | unknown,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      error,
      metadata,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case "debug":
        console.log(formatted);
        break;
      case "info":
        console.log(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  debug(
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    this.log("debug", message, context, undefined, metadata);
  }

  info(
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    this.log("info", message, context, undefined, metadata);
  }

  warn(
    message: string,
    context?: LogContext,
    error?: Error | unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.log("warn", message, context, error, metadata);
  }

  error(
    message: string,
    context?: LogContext,
    error?: Error | unknown,
    metadata?: Record<string, unknown>
  ): void {
    this.log("error", message, context, error, metadata);
  }
}

export const logger = new Logger();
