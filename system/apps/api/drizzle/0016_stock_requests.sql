CREATE TABLE "payment_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_request_id" uuid NOT NULL,
	"stock_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "price" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_request_items" ADD CONSTRAINT "payment_request_items_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_request_items" ADD CONSTRAINT "payment_request_items_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_request_items_request_idx" ON "payment_request_items" USING btree ("payment_request_id");--> statement-breakpoint
-- Same visibility as the request itself: the owner, admin and adviser read; the owner and admin write; the client's
-- payment page reads the lines of its own request.
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_request_items TO proofpocket_app;
--> statement-breakpoint
ALTER TABLE payment_request_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY payment_request_items_read ON payment_request_items FOR SELECT USING (
  payment_request_id = app_pay_request_id() OR EXISTS (SELECT 1 FROM payment_requests r WHERE r.id = payment_request_id AND app_has(r.company_id, '{owner,admin,adviser}')));
--> statement-breakpoint
CREATE POLICY payment_request_items_write ON payment_request_items FOR ALL
  USING (EXISTS (SELECT 1 FROM payment_requests r WHERE r.id = payment_request_id AND app_has(r.company_id, '{owner,admin}')))
  WITH CHECK (EXISTS (SELECT 1 FROM payment_requests r WHERE r.id = payment_request_id AND app_has(r.company_id, '{owner,admin}')));
