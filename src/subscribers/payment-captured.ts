import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export default async function paymentCapturedHandler({
  event: { data, name },
  container,
}: SubscriberArgs<{ id: string }>) {
  const documentModuleService: any = container.resolve("documents")
  const fileModuleService: any = container.resolve(Modules.FILE)
  const notificationModuleService: any = container.resolve(Modules.NOTIFICATION)

// 1. Resolve query engine
  const query = container.resolve("query")

  // 2. Fetch the rich order graph
  const { data: orders } = await query.graph({
    entity: "order",
    fields:[
      "*",
      "items.*",
      "customer.*",
      "billing_address.*",
      "shipping_address.*",
      "payment_collections.*",
      "payment_collections.payments.*",
      "payment_collections.payments.refunds.*",
      "summary.*"
    ],
    filters: { 
      id: [data.id] 
    }
  })

  const order = orders[0]
  if (!order) return

  // Determine subject and type based on event
  let subject = `Receipt for Order #${order.display_id}`
  let type = "receipt"
  if (name === "order.payment_refunded" || name === "order.refund.created" || name === "payment.refunded") {
    subject = `Refund Receipt for Order #${order.display_id}`
    type = "credit_note"
  }

  // 1.5. Idempotency Check: Don't generate if document already exists
  // (Note: For credit notes, we might want multiple if there are multiple refunds, 
  // but for receipts, we usually only want one. We'll skip the check for credit notes for now).
  if (type === "receipt") {
    const existingDocs = await documentModuleService.listDocuments({ order_id: data.id, type: "receipt" })
    if (existingDocs.length > 0) {
      return
    }
  }

  // 2. Fetch Settings
  const [settings] = await documentModuleService.listDocumentSettings({}, { take: 1 })
  const activeSettings = settings || { store_name: "My Store", primary_color: "#111827" }

  // 3. Generate and Save the "Receipt" or "Credit Note"
  const result = await documentModuleService.generateAndSaveInvoice(
    order,
    activeSettings,
    fileModuleService,
    activeSettings.template || "classic",
    type
  )

  // 4. Send Email via Resend
  const notificationData: any = {
    to: order.email,
    channel: "email",
    template: "invoice-template",
    data: {
      order_id: order.display_id,
      customer_name: order.billing_address?.first_name || "Customer",
      store_name: activeSettings.store_name,
      subject: subject,
    },
    attachments:[{
      filename: `${type}-${order.display_id}.pdf`,
      content: result.buffer.toString("base64"),
      type: "application/pdf",
    }],
  }

  if (activeSettings.company_email) {
    notificationData.cc = activeSettings.company_email
  }

  await notificationModuleService.createNotifications(notificationData)
}

export const config: SubscriberConfig = {
  event:["order.payment_captured", "order.payment_refunded", "order.refund.created", "payment.refunded"],
}
