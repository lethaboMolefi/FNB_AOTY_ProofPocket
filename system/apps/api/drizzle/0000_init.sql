CREATE TYPE "public"."application_status" AS ENUM('submitted', 'under_review', 'offer_made', 'awaiting_cofunding', 'approved', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."area" AS ENUM('township', 'urban', 'rural');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('beauty', 'food', 'retail', 'recycling', 'trades', 'services');--> statement-breakpoint
CREATE TYPE "public"."change_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('cipc', 'id', 'bank', 'addr', 'tax', 'bplan', 'fin', 'bbbee', 'csd');--> statement-breakpoint
CREATE TYPE "public"."entry_source" AS ENUM('manual', 'statement', 'proof', 'cash_request', 'restock', 'supplier_payment', 'cash_payout', 'seed');--> statement-breakpoint
CREATE TYPE "public"."feature_status" AS ENUM('none', 'requested', 'featured', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."file_purpose" AS ENUM('document', 'receipt', 'proof', 'statement');--> statement-breakpoint
CREATE TYPE "public"."funder_sharing" AS ENUM('none', 'summary', 'full');--> statement-breakpoint
CREATE TYPE "public"."handled_status" AS ENUM('requested', 'arranged', 'declined');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('requested', 'active', 'left', 'declined');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('system', 'organisation', 'client_flag', 'checked_by_founder');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('open', 'blocked', 'safe');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('funder', 'incubator', 'buyer');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('sign_in', 'payment_details');--> statement-breakpoint
CREATE TYPE "public"."pay_method" AS ENUM('cash', 'card_machine', 'eft', 'payshap', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('waiting', 'checking', 'paid', 'not_received', 'flagged', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."programme_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."proof_status" AS ENUM('submitted', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rail" AS ENUM('payshap', 'eft', 'cash', 'card_machine');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('company', 'payment_request', 'post', 'message_sender');--> statement-breakpoint
CREATE TYPE "public"."statement_line_status" AS ENUM('unsorted', 'added', 'personal', 'skipped', 'already_in_books');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('founder', 'funder', 'adviser', 'buyer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."watch_status" AS ENUM('watch', 'confirmed_scam', 'cleared');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text NOT NULL,
	"actor_id" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"company_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"slug" text NOT NULL,
	"business_type" "business_type" NOT NULL,
	"sector" text NOT NULL,
	"town" text NOT NULL,
	"province" text NOT NULL,
	"area" "area" NOT NULL,
	"cipc_number" text,
	"stage" text DEFAULT 'Early' NOT NULL,
	"employees" integer DEFAULT 1 NOT NULL,
	"founded_year" smallint NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"opening_balance_date" date NOT NULL,
	"funder_sharing" "funder_sharing" DEFAULT 'summary' NOT NULL,
	"verified_at" timestamp with time zone,
	"incubator_id" uuid,
	"adviser_id" uuid,
	"support_stage" smallint DEFAULT 0 NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_owner_id_unique" UNIQUE("owner_id"),
	CONSTRAINT "companies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "companies_support_stage_range" CHECK ("companies"."support_stage" between 0 and 4),
	CONSTRAINT "companies_cipc_format" CHECK ("companies"."cipc_number" is null or "companies"."cipc_number" ~ '^[0-9]{4}/[0-9]{6}/[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"status" "doc_status" DEFAULT 'pending' NOT NULL,
	"file_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"expires_on" date,
	"uploaded_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reject_reason" text,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_reject_has_reason" CHECK ("documents"."status" <> 'rejected' or length(coalesce("documents"."reject_reason", '')) > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"purpose" "file_purpose" NOT NULL,
	"bucket_path" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text,
	"original_name" text NOT NULL,
	"uploaded_by" uuid,
	"registered_at" timestamp with time zone,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_bucket_path_unique" UNIQUE("bucket_path"),
	CONSTRAINT "files_size_limit" CHECK ("files"."size_bytes" > 0 and "files"."size_bytes" <= 5242880)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incubator_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"incubator_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'requested' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "org_type" NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"verified" boolean DEFAULT false NOT NULL,
	"setup_done" boolean DEFAULT false NOT NULL,
	"wants" text,
	"sectors" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"org_id" uuid,
	"is_lead" boolean DEFAULT false NOT NULL,
	"otp_verified_auth_time" bigint,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_org_matches_role" CHECK (("users"."role" in ('founder', 'admin')) or "users"."org_id" is not null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"client_uuid" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"direction" "direction" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "pay_method" NOT NULL,
	"category" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"is_personal" boolean DEFAULT false NOT NULL,
	"paid_back_at" timestamp with time zone,
	"receipt_file_id" uuid,
	"receipt_kept" boolean DEFAULT false NOT NULL,
	"stock_item_id" uuid,
	"qty" numeric(12, 2),
	"supplier_id" uuid,
	"payment_request_id" uuid,
	"payment_proof_id" uuid,
	"statement_line_id" uuid,
	"slip_number" text,
	"source" "entry_source" DEFAULT 'manual' NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_by" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_client_uuid_unique" UNIQUE("client_uuid"),
	CONSTRAINT "ledger_amount_positive" CHECK ("ledger_entries"."amount" > 0),
	CONSTRAINT "ledger_personal_is_out" CHECK (not "ledger_entries"."is_personal" or "ledger_entries"."direction" = 'out'),
	CONSTRAINT "ledger_void_has_reason" CHECK ("ledger_entries"."voided_at" is null or length(coalesce("ledger_entries"."void_reason", '')) > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"month" date NOT NULL,
	"money_in" numeric(12, 2) DEFAULT '0' NOT NULL,
	"money_out" numeric(12, 2) DEFAULT '0' NOT NULL,
	"source" text DEFAULT 'self_reported' NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_history_first_of_month" CHECK (extract(day from "monthly_history"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"file_id" uuid,
	"bank" text,
	"format" text NOT NULL,
	"line_count" integer DEFAULT 0 NOT NULL,
	"imported_by" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"line_date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"direction" "direction" NOT NULL,
	"status" "statement_line_status" DEFAULT 'unsorted' NOT NULL,
	"matched_entry_id" uuid,
	"ledger_entry_id" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'units' NOT NULL,
	"reorder_at" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"archived_at" timestamp with time zone,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stock_item_id" uuid NOT NULL,
	"client_uuid" uuid NOT NULL,
	"delta" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"ledger_entry_id" uuid,
	"created_by" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_client_uuid_unique" UNIQUE("client_uuid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_bank_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"from_masked" text NOT NULL,
	"to_masked" text NOT NULL,
	"status" "change_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"bank_masked" text NOT NULL,
	"pending_bank_masked" text,
	"pending_since" date,
	"archived_at" timestamp with time zone,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" "message_kind" NOT NULL,
	"sender" text NOT NULL,
	"sender_address" text DEFAULT '' NOT NULL,
	"sender_org_id" uuid,
	"verified_sender" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"risk_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "message_status" DEFAULT 'open' NOT NULL,
	"payment_request_id" uuid,
	"received_on" date DEFAULT current_date NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"bank" text DEFAULT '' NOT NULL,
	"account_name" text DEFAULT '' NOT NULL,
	"account_number_enc" text,
	"account_last4" text,
	"shap_id" text DEFAULT '' NOT NULL,
	"in_business_name" boolean,
	"changed_by" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_request_id" uuid NOT NULL,
	"payer_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"method" "rail" NOT NULL,
	"used_reference" boolean NOT NULL,
	"file_id" uuid,
	"check_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "proof_status" DEFAULT 'submitted' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"public_token" text NOT NULL,
	"client_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rails" "rail"[] NOT NULL,
	"status" "payment_status" DEFAULT 'waiting' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"requested_on" date NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_requests_ref_unique" UNIQUE("ref"),
	CONSTRAINT "payment_requests_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "payment_requests_amount_positive" CHECK ("payment_requests"."amount" > 0),
	CONSTRAINT "payment_requests_has_rail" CHECK (cardinality("payment_requests"."rails") > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sender_watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_key" text NOT NULL,
	"reports" smallint DEFAULT 1 NOT NULL,
	"status" "watch_status" DEFAULT 'watch' NOT NULL,
	"last_reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sender_watchlist_sender_key_unique" UNIQUE("sender_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"programme_id" uuid NOT NULL,
	"funder_id" uuid NOT NULL,
	"requested_amount" numeric(12, 2) NOT NULL,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"status_reason" text DEFAULT '' NOT NULL,
	"reason_requested" boolean DEFAULT false NOT NULL,
	"applied_on" date DEFAULT current_date NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_decline_has_reason" CHECK ("applications"."status" <> 'declined' or length("applications"."status_reason") > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intro_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"status" "handled_status" DEFAULT 'requested' NOT NULL,
	"handled_by" uuid,
	"note" text,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"changed_by" uuid,
	"offered_on" date DEFAULT current_date NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"text" text NOT NULL,
	"posted_on" date DEFAULT current_date NOT NULL,
	"shared_to" text[] DEFAULT '{}'::text[] NOT NULL,
	"feature" "feature_status" DEFAULT 'none' NOT NULL,
	"featured_until" date,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_text_length" CHECK (length("posts"."text") between 1 and 400)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"services" text DEFAULT '' NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"hours" text DEFAULT '' NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_tagline_length" CHECK (length("profiles"."tagline") <= 90)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "programme_requirements" (
	"programme_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programme_requirements_programme_id_doc_type_pk" PRIMARY KEY("programme_id","doc_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "programmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funder_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_amount" numeric(12, 2) NOT NULL,
	"max_amount" numeric(12, 2) NOT NULL,
	"budget" numeric(12, 2) DEFAULT '0' NOT NULL,
	"committed" numeric(12, 2) DEFAULT '0' NOT NULL,
	"min_months" smallint DEFAULT 0 NOT NULL,
	"min_score" smallint DEFAULT 0 NOT NULL,
	"status" "programme_status" DEFAULT 'open' NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programmes_amount_range" CHECK ("programmes"."min_amount" <= "programmes"."max_amount"),
	CONSTRAINT "programmes_score_range" CHECK ("programmes"."min_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" text NOT NULL,
	"company_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"reporter_user_id" uuid,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"incubator_id" uuid NOT NULL,
	"adviser_id" uuid,
	"support_type" text NOT NULL,
	"note" text NOT NULL,
	"log_date" date DEFAULT current_date NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tender_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"status" "handled_status" DEFAULT 'requested' NOT NULL,
	"handled_by" uuid,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tender_requirements" (
	"tender_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tender_requirements_tender_id_doc_type_pk" PRIMARY KEY("tender_id","doc_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_org_id" uuid,
	"value" numeric(12, 2) NOT NULL,
	"closes_on" date NOT NULL,
	"min_months" smallint DEFAULT 0 NOT NULL,
	"sectors" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity" ADD CONSTRAINT "activity_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_incubator_id_organisations_id_fk" FOREIGN KEY ("incubator_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_adviser_id_users_id_fk" FOREIGN KEY ("adviser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incubator_memberships" ADD CONSTRAINT "incubator_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incubator_memberships" ADD CONSTRAINT "incubator_memberships_incubator_id_organisations_id_fk" FOREIGN KEY ("incubator_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incubator_memberships" ADD CONSTRAINT "incubator_memberships_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_receipt_file_id_files_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monthly_history" ADD CONSTRAINT "monthly_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_import_id_statement_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."statement_imports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_matched_entry_id_ledger_entries_id_fk" FOREIGN KEY ("matched_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_bank_changes" ADD CONSTRAINT "supplier_bank_changes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_bank_changes" ADD CONSTRAINT "supplier_bank_changes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_bank_changes" ADD CONSTRAINT "supplier_bank_changes_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_bank_changes" ADD CONSTRAINT "supplier_bank_changes_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_org_id_organisations_id_fk" FOREIGN KEY ("sender_org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_details" ADD CONSTRAINT "payment_details_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_details" ADD CONSTRAINT "payment_details_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_funder_id_organisations_id_fk" FOREIGN KEY ("funder_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intro_requests" ADD CONSTRAINT "intro_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intro_requests" ADD CONSTRAINT "intro_requests_buyer_id_organisations_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intro_requests" ADD CONSTRAINT "intro_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offers" ADD CONSTRAINT "offers_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "programme_requirements" ADD CONSTRAINT "programme_requirements_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "programmes" ADD CONSTRAINT "programmes_funder_id_organisations_id_fk" FOREIGN KEY ("funder_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_logs" ADD CONSTRAINT "support_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_logs" ADD CONSTRAINT "support_logs_incubator_id_organisations_id_fk" FOREIGN KEY ("incubator_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_logs" ADD CONSTRAINT "support_logs_adviser_id_users_id_fk" FOREIGN KEY ("adviser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_interests" ADD CONSTRAINT "tender_interests_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_interests" ADD CONSTRAINT "tender_interests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_interests" ADD CONSTRAINT "tender_interests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tender_requirements" ADD CONSTRAINT "tender_requirements_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenders" ADD CONSTRAINT "tenders_buyer_org_id_organisations_id_fk" FOREIGN KEY ("buyer_org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_company_idx" ON "activity" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_incubator_idx" ON "companies" USING btree ("incubator_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_company_type_version_key" ON "documents" USING btree ("company_id","doc_type","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_sha256_idx" ON "files" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_company_idx" ON "incubator_memberships" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otp_user_idx" ON "otp_challenges" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_company_date_idx" ON "ledger_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_company_slip_key" ON "ledger_entries" USING btree ("company_id","slip_number") WHERE "ledger_entries"."slip_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_history_company_month_key" ON "monthly_history" USING btree ("company_id","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "statement_lines_company_idx" ON "statement_lines" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_item_idx" ON "stock_movements" USING btree ("stock_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_company_idx" ON "messages" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_details_company_idx" ON "payment_details" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_proofs_request_idx" ON "payment_proofs" USING btree ("payment_request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_requests_company_idx" ON "payment_requests" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "applications_company_programme_key" ON "applications" USING btree ("company_id","programme_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_funder_idx" ON "applications" USING btree ("funder_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "intro_requests_key" ON "intro_requests" USING btree ("company_id","buyer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offers_application_idx" ON "offers" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_logs_company_idx" ON "support_logs" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tender_interests_key" ON "tender_interests" USING btree ("tender_id","company_id");