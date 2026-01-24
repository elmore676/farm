import winston from 'winston';
import 'winston-daily-rotate-file';
import { isProd } from './env';

const transportConsole = new winston.transports.Console({
  format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
});

const transportFile = new (winston.transports as any).DailyRotateFile({
  dirname: 'logs',
  filename: '%DATE%-app.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
});

export const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: isProd ? [transportFile, transportConsole] : [transportConsole],
});

export const requestLoggerStream = {
  write: (message: string) => logger.http ? logger.http(message.trim()) : logger.info(message.trim()),
};
