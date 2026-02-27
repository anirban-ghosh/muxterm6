import pino from 'pino'
import { app } from 'electron'
import { join } from 'path'

const logPath = join(app.getPath('userData'), 'muxterm.log')

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: logPath, mkdir: true }
      },
      {
        target: 'pino/file',
        options: { destination: 1 } // stdout
      }
    ]
  }
})

export default logger
