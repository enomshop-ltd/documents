import { model } from "@medusajs/framework/utils"

export const DocumentSettings = model.define("document_settings", {
  id: model.id().primaryKey(),
  store_name: model.text(),
  address: model.text().nullable(),
  city: model.text().nullable(),
  country_code: model.text().nullable(),
  zip_code: model.text().nullable(),
  phone: model.text().nullable(),
  email: model.text().nullable(),
  company_email: model.text().nullable(),
  logo_url: model.text().nullable(),
  invoice_prefix: model.text().default("INV-"),
  invoice_number_start: model.number().default(1),
  primary_color: model.text().default("#111827"),
  footer_text: model.text().nullable(),
  
  // New large text fields for the reference image layout
  terms: model.text().nullable(),
  bank_details: model.text().nullable(),
})
