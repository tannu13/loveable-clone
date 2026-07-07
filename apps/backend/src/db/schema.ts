import { relations } from "drizzle-orm";
import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const messageHistory = pgTable("message_history", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id),
  message: jsonb("messages").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const conversationRelations = relations(conversations, ({ many }) => ({
  messageHistory: many(messageHistory),
}));

export const messageHistoryRelations = relations(messageHistory, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messageHistory.conversationId],
    references: [conversations.id],
  }),
}));
