import { defineCollection } from '@nocobase/database';

// Which project a digital-consultant conversation belongs to, read once from the page
// context of its first message; AI usage is attributed through it.
export default defineCollection({
  name: 'dz_ai_sessions',
  title: 'AI 会话归属',
  fields: [
    { type: 'string', name: 'sessionId', unique: true, allowNull: false },
    { type: 'bigInt', name: 'projectId' },
  ],
});
