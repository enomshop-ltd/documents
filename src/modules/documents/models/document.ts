import { model } from "@medusajs/framework/utils"

export const Document = model.define("document", {
  id: model.id().primaryKey(),
  type: model.enum(["invoice", "receipt", "packing_slip", "credit_note"]), 
  order_id: model.text().index(),
  file_key: model.text(),
  document_number: model.text().unique(),
})
