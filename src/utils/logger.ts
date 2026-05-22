type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// En production, on minimise les logs
const CURRENT_LEVEL: LogLevel = __DEV__ ? "debug" : "warn";

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
};

const formatMessage = (level: LogLevel, tag: string, message: string, data?: unknown): string => {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = { debug: "🔍", info: "ℹ️", warn: "⚠️", error: "❌" }[level];
  const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
  return `${prefix} [${timestamp}] [${tag}] ${message}${dataStr}`;
};

export const logger = {
  debug: (tag: string, message: string, data?: unknown) => {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", tag, message, data));
    }
  },

  info: (tag: string, message: string, data?: unknown) => {
    if (shouldLog("info")) {
      console.log(formatMessage("info", tag, message, data));
    }
  },

  warn: (tag: string, message: string, data?: unknown) => {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", tag, message, data));
    }
  },

  error: (tag: string, message: string, data?: unknown) => {
    if (shouldLog("error")) {
      console.error(formatMessage("error", tag, message, data));
    }
  },
};
