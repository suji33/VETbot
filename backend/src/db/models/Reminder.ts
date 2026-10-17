import mongoose, { Schema, Document } from 'mongoose';

export type ReminderType = 'feeding' | 'vaccination' | 'medication' | 'followup' | 'other';
export type ReminderStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface IReminder extends Document {
  ownerId: string;           // session/user ID
  petId?: string;
  petName?: string;          // cached for display
  type: ReminderType;
  title: string;             // e.g., "Feed Bruno"
  description?: string;
  cronExpression: string;    // e.g., "0 7 * * *" for daily 7 AM
  timezone: string;          // e.g., "Asia/Kolkata"
  isRecurring: boolean;
  nextExecutionAt?: Date;
  lastDeliveredAt?: Date;
  lastDeliveryStatus?: 'success' | 'failed' | 'pending';
  failureCount: number;
  status: ReminderStatus;
  notificationChannel: string;  // "in-app" | "email"
  n8nWorkflowId?: string;       // for n8n integration (optional)
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>({
  ownerId:             { type: String, required: true, index: true },
  petId:               { type: String },
  petName:             { type: String },
  type:                { type: String, enum: ['feeding','vaccination','medication','followup','other'], required: true },
  title:               { type: String, required: true, maxlength: 128 },
  description:         { type: String, maxlength: 500 },
  cronExpression:      { type: String, required: true },
  timezone:            { type: String, required: true, default: 'Asia/Kolkata' },
  isRecurring:         { type: Boolean, default: true },
  nextExecutionAt:     { type: Date },
  lastDeliveredAt:     { type: Date },
  lastDeliveryStatus:  { type: String, enum: ['success','failed','pending'] },
  failureCount:        { type: Number, default: 0 },
  status:              { type: String, enum: ['active','paused','completed','cancelled'], default: 'active' },
  notificationChannel: { type: String, default: 'in-app' },
  n8nWorkflowId:       { type: String },
}, { timestamps: true });

export const Reminder = mongoose.model<IReminder>('Reminder', ReminderSchema);
