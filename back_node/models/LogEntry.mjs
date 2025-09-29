// models/LogEntry.mjs
import mongoose from 'mongoose';

const logEntrySchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'], required: true },
    message: { type: String, required: true },
    action: { type: String, required: true },
    userId: { type: String, default: null },
    userEmail: { type: String, default: 'guest', index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { collection: 'logs' }
);

// Для быстрых срезов по времени и фильтрации по email
logEntrySchema.index({ timestamp: -1, userEmail: 1 });

const LogEntry = mongoose.model('LogEntry', logEntrySchema);
export default LogEntry;

