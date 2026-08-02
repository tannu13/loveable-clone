import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 255 }).unique(),
  isAnonymous: boolean("is_anonymous").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("conversations_user_id_idx").on(table.userId)],
);

export const messageRoleEnum = pgEnum("role", ["user", "assistant"]);
export type TMessageRoleEnum = (typeof messageRoleEnum.enumValues)[number];

export const messageTypeEnum = pgEnum("type", ["text", "qna", "plan"]);
export type TMessageTypeEnum = (typeof messageTypeEnum.enumValues)[number];

export const messageHistory = pgTable("message_history", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id),
  content: text("content").notNull(),
  role: messageRoleEnum().notNull(),
  type: messageTypeEnum().notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
}));

export const conversationRelations = relations(
  conversations,
  ({ many, one }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messageHistory: many(messageHistory),
  }),
);

export const messageHistoryRelations = relations(messageHistory, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messageHistory.conversationId],
    references: [conversations.id],
  }),
}));
