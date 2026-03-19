import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260311134535 extends Migration {

  override async up(): Promise<void> {
    // Add this line to clear the old, broken table
    this.addSql(`drop table if exists "document_settings" cascade;`);
    this.addSql(`drop table if exists "document" cascade;`);
    
    this.addSql(`alter table if exists "document" drop constraint if exists "document_document_number_unique";`);
    this.addSql(`create table if not exists "document" ("id" text not null, "type" text check ("type" in ('invoice', 'receipt', 'packing_slip', 'credit_note')) not null, "order_id" text not null, "file_key" text not null, "document_number" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "document_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_order_id" ON "document" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_document_document_number_unique" ON "document" ("document_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_deleted_at" ON "document" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "document_settings" ("id" text not null, "store_name" text not null, "address" text null, "city" text null, "country_code" text null, "zip_code" text null, "phone" text null, "email" text null, "company_email" text null, "logo_url" text null, "invoice_prefix" text not null default 'INV-', "invoice_number_start" integer not null default 1, "primary_color" text not null default '#111827', "footer_text" text null, "terms" text null, "bank_details" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "document_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_settings_deleted_at" ON "document_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "document" cascade;`);

    this.addSql(`drop table if exists "document_settings" cascade;`);
  }

}
