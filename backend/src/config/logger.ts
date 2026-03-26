import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf((info) =>
      info.stack
        ? `${String(info.timestamp)} [${info.level}]: ${info.message}\n${info.stack}`
        : `${String(info.timestamp)} [${info.level}]: ${info.message}`,
    ),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});
