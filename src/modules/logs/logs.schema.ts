import { z } from "zod";

export const logEntrySchema = z.object({
  timestamp: z.string().datetime({ message: "Invalid ISO datetime string" }),
  endpoint: z.string().min(1).startsWith("/"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  statusCode: z.number().int().min(100).max(599),
  responseTime: z.number().positive(),
  dbQueryTime: z.number().positive().optional(),
});

export const batchLogsSchema = z.object({
  logs: z
    .array(logEntrySchema)
    .min(1, "At least one log entry required")
    .max(1000, "Maximum 1000 log entries per batch"),
});

export type LogEntry = z.infer<typeof logEntrySchema>;
export type BatchLogsInput = z.infer<typeof batchLogsSchema>;
