import mongoose, { Schema, Document } from 'mongoose';

export interface IPet extends Document {
  ownerId: string;       // session/user ID
  name: string;
  species: string;
  breed?: string;
  age?: number;          // in months
  weightKg?: number;
  sex?: 'male' | 'female' | 'unknown' | string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PetSchema = new Schema<IPet>({
  ownerId:  { type: String, required: true, index: true },
  name:     { type: String, required: true, trim: true, maxlength: 64 },
  species:  { type: String, required: true, trim: true, maxlength: 64, default: 'other' },
  breed:    { type: String, trim: true, maxlength: 64 },
  age:      { type: Number, min: 0, max: 600 },   // months (max 50 years)
  weightKg: { type: Number, min: 0, max: 200 },
  sex:      { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  notes:    { type: String, maxlength: 1000 },
}, { timestamps: true });

export const Pet = mongoose.model<IPet>('Pet', PetSchema);
