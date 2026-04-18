type Level = 'info' | 'warn' | 'error' | 'debug'
type LogData = Record<string, unknown>

function log(level: Level, msg: string, data?: LogData): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...data,
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (msg: string, data?: LogData) => log('info', msg, data),
  warn: (msg: string, data?: LogData) => log('warn', msg, data),
  error: (msg: string, data?: LogData) => log('error', msg, data),
  debug: (msg: string, data?: LogData) => {
    if (process.env.LOG_LEVEL === 'debug') log('debug', msg, data)
  },
}
