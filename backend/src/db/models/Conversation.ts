import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;       // temporary base64 or URL, not stored long-term
  sources?: Array<{
    title: string;
    url?: string;
    excerpt: string;
  }>;
  isEmergency?: boolean;
  timestamp: Date;
}

export interface IConversation extends Document {
  sessionId: string;       // anonymous UUID from frontend
  petId?: string;          // optional: linked pet profile
  petSpecies?: string;     // cached for quick context
  context?: any;           // structured multi-turn conversation context
  messages: IMessage[];
  title?: string;          // auto-generated from first message
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role:        { type: String, enum: ['user', 'assistant'], required: true },
  content:     { type: String, required: true, maxlength: 20000 },
  imageUrl:    { type: String },    // NOT stored permanently — just metadata
  sources:     [{
    title:   { type: String },
    url:     { type: String },
    excerpt: { type: String, maxlength: 500 },
  }],
  isEmergency: { type: Boolean, default: false },
  timestamp:   { type: Date, default: Date.now },
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
  sessionId:  { type: String, required: true, index: true },
  petId:      { type: String },
  petSpecies: { type: String },
  context:    { type: Schema.Types.Mixed, default: {} },
  messages:   { type: [MessageSchema], default: [] },
  title:      { type: String, maxlength: 128 },
}, { timestamps: true });

// Keep only last 50 messages per conversation for storage efficiency
ConversationSchema.pre('save', function (next) {
  if (this.messages.length > 50) {
    this.messages = this.messages.slice(-50);
  }
  next();
});

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
