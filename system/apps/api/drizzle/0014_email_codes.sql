CREATE TABLE "email_codes" (
	"firebase_uid" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Only the API's sign-in context (role 'auth') reads or writes codes.
GRANT SELECT, INSERT, UPDATE, DELETE ON email_codes TO proofpocket_app;
--> statement-breakpoint
ALTER TABLE email_codes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY email_codes_auth ON email_codes FOR ALL USING (app_role() = 'auth') WITH CHECK (app_role() = 'auth');
