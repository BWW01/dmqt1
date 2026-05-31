import {
    pgTable,
    serial,
    text,
    integer,
    timestamp,
    jsonb,
    uniqueIndex,
    foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Táblák Definiálása ---

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    role: text("role").notNull().default("user"),
    credits: integer("credits").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(), // Javaslat: Használj nanoid-ot vagy uuid-t alapértelmezettnek
    userId: integer("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
    title: text("title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(), // Automatikus frissítéshez db trigger vagy manuális mentés kell
});

export const messages = pgTable("messages", {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    sender: text("sender").notNull(),
    content: text("content").notNull(),
    metaJson: jsonb("meta_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const runs = pgTable("runs", {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
    conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: 'cascade' }),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text("status").notNull().default("running"),
    userInput: text("user_input").notNull(),
    paramsJson: jsonb("params_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
});

export const runModels = pgTable("run_models", {
    id: serial("id").primaryKey(),
    runId: integer("run_id").notNull().references(() => runs.id, { onDelete: 'cascade' }),
    modelName: text("model_name").notNull(),
    status: text("status").notNull().default("queued"),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
});

export const runOutputs = pgTable("run_outputs", {
    id: serial("id").primaryKey(),
    runModelId: integer("run_model_id").notNull().references(() => runModels.id, { onDelete: 'cascade' }),
    outputText: text("output_text").notNull(),
    rawResponseJson: jsonb("raw_response_json"),
});

export const attachments = pgTable("attachments", {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    messageId: integer("message_id").references(() => messages.id, { onDelete: 'cascade' }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Relációk Definiálása (Drizzle-way) ---

export const usersRelations = relations(users, ({ many }) => ({
    projects: many(projects),
    runs: many(runs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
    user: one(users, { fields: [projects.userId], references: [users.id] }),
    conversations: many(conversations),
    runs: many(runs),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    project: one(projects, { fields: [conversations.projectId], references: [projects.id] }),
    messages: many(messages),
    runs: many(runs),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
    attachments: many(attachments),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
    project: one(projects, { fields: [runs.projectId], references: [projects.id] }),
    conversation: one(conversations, { fields: [runs.conversationId], references: [conversations.id] }),
    creator: one(users, { fields: [runs.createdBy], references: [users.id] }),
    runModels: many(runModels),
}));

export const runModelsRelations = relations(runModels, ({ one, many }) => ({
    run: one(runs, { fields: [runModels.runId], references: [runs.id] }),
    outputs: many(runOutputs),
}));

export const runOutputsRelations = relations(runOutputs, ({ one }) => ({
    runModel: one(runModels, { fields: [runOutputs.runModelId], references: [runModels.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
    message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
}));