CREATE TYPE "public"."portal_application_kind" AS ENUM('funder', 'support_org');--> statement-breakpoint
CREATE TYPE "public"."portal_application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "company_cofounders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"id_number_enc" text NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"shareholding" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "founder_identity" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"id_number_enc" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "portal_application_kind" NOT NULL,
	"status" "portal_application_status" DEFAULT 'pending' NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"contact_name" text NOT NULL,
	"org_name" text NOT NULL,
	"contact_id_number_enc" text NOT NULL,
	"details" jsonb NOT NULL,
	"review_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"org_id" uuid,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_cofounders" ADD CONSTRAINT "company_cofounders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "founder_identity" ADD CONSTRAINT "founder_identity_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_applications" ADD CONSTRAINT "portal_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_applications" ADD CONSTRAINT "portal_applications_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_applications" ADD CONSTRAINT "portal_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_applications_uid_key" ON "portal_applications" USING btree ("firebase_uid");--> statement-breakpoint

-- ---------------------------------------------------------------- row-level security
-- Founders' ID numbers and co-founders: the owner and the admin only (not advisers, not funders).
ALTER TABLE founder_identity ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY founder_identity_read ON founder_identity FOR SELECT USING (app_has(company_id, ARRAY['owner', 'admin']));
--> statement-breakpoint
CREATE POLICY founder_identity_write ON founder_identity FOR ALL USING (app_has(company_id, ARRAY['owner'])) WITH CHECK (app_has(company_id, ARRAY['owner']));
--> statement-breakpoint
ALTER TABLE company_cofounders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY company_cofounders_read ON company_cofounders FOR SELECT USING (app_has(company_id, ARRAY['owner', 'admin']));
--> statement-breakpoint
CREATE POLICY company_cofounders_write ON company_cofounders FOR ALL USING (app_has(company_id, ARRAY['owner'])) WITH CHECK (app_has(company_id, ARRAY['owner']));
--> statement-breakpoint

-- Portal applications: a new sign-in (role 'joining') may send one pending application for itself and read it
-- back; it can never mark it reviewed or link it to an organisation or user. Only the admin reviews. No deletes.
ALTER TABLE portal_applications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY portal_applications_apply ON portal_applications FOR INSERT WITH CHECK (
  app_role() = 'joining' AND firebase_uid = nullif(current_setting('app.firebase_uid', true), '')
  AND status = 'pending' AND review_reason IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL AND org_id IS NULL AND user_id IS NULL);
--> statement-breakpoint
CREATE POLICY portal_applications_own ON portal_applications FOR SELECT USING (
  app_role() = 'joining' AND firebase_uid = nullif(current_setting('app.firebase_uid', true), ''));
--> statement-breakpoint
CREATE POLICY portal_applications_admin_read ON portal_applications FOR SELECT USING (app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY portal_applications_admin_review ON portal_applications FOR UPDATE USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
--> statement-breakpoint
-- A decided application stays decided: reviews can't be rewritten or reopened.
CREATE OR REPLACE FUNCTION portal_applications_decided_once() RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'portal application % is already %', OLD.id, OLD.status USING ERRCODE = '42501';
  END IF;
  IF NEW.firebase_uid <> OLD.firebase_uid OR NEW.kind <> OLD.kind OR NEW.contact_id_number_enc <> OLD.contact_id_number_enc THEN
    RAISE EXCEPTION 'portal application identity cannot change' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER portal_applications_decided_once BEFORE UPDATE ON portal_applications FOR EACH ROW EXECUTE FUNCTION portal_applications_decided_once();
