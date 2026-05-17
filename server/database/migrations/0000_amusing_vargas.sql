CREATE TABLE "attachments" (
                               "id" serial PRIMARY KEY NOT NULL,
                               "filename" text NOT NULL,
                               "path" text NOT NULL,
                               "mime_type" text NOT NULL,
                               "message_id" integer,
                               "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
                                 "id" serial PRIMARY KEY NOT NULL,
                                 "project_id" integer NOT NULL,
                                 "title" text,
                                 "created_at" timestamp DEFAULT now() NOT NULL,
                                 "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
                            "id" serial PRIMARY KEY NOT NULL,
                            "conversation_id" integer NOT NULL,
                            "sender" text NOT NULL,
                            "content" text NOT NULL,
                            "meta_json" jsonb,
                            "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
                            "id" serial PRIMARY KEY NOT NULL,
                            "slug" text NOT NULL,
                            "user_id" integer NOT NULL,
                            "name" text NOT NULL,
                            "created_at" timestamp DEFAULT now() NOT NULL,
                            CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "run_models" (
                              "id" serial PRIMARY KEY NOT NULL,
                              "run_id" integer NOT NULL,
                              "model_name" text NOT NULL,
                              "status" text DEFAULT 'queued' NOT NULL,
                              "latency_ms" integer,
                              "error_code" text,
                              "error_message" text,
                              "started_at" timestamp,
                              "finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "run_outputs" (
                               "id" serial PRIMARY KEY NOT NULL,
                               "run_model_id" integer NOT NULL,
                               "output_text" text NOT NULL,
                               "raw_response_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "runs" (
                        "id" serial PRIMARY KEY NOT NULL,
                        "project_id" integer NOT NULL,
                        "conversation_id" integer,
                        "created_by" integer NOT NULL,
                        "status" text DEFAULT 'running' NOT NULL,
                        "user_input" text NOT NULL,
                        "params_json" jsonb,
                        "created_at" timestamp DEFAULT now() NOT NULL,
                        "finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
                         "id" serial PRIMARY KEY NOT NULL,
                         "email" text NOT NULL,
                         "password_hash" text NOT NULL,
                         "password_salt" text NOT NULL,
                         "role" text DEFAULT 'user' NOT NULL,
                         "credits" double precision DEFAULT 0 NOT NULL,
                         "created_at" timestamp DEFAULT now() NOT NULL,
                         CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_models" ADD CONSTRAINT "run_models_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_outputs" ADD CONSTRAINT "run_outputs_run_model_id_run_models_id_fk" FOREIGN KEY ("run_model_id") REFERENCES "public"."run_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;