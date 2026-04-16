import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '[{module}] {msg}',
      },
    },
  }),
})

/**
 * Creates a child logger scoped to a specific module.
 * Usage: const log = createLogger('OllamaProvider')
 */
export function createLogger(module: string) {
  return logger.child({ module })
}
