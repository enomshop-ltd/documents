import { SubscriberConfig, SubscriberArgs } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export default async function orderPlacedHandler({
  event: { data, name },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const documentModuleService: any = container.resolve("documents")
  const fileModuleService: any = container.resolve(Modules.FILE)
  const notificationModuleService: any = container.resolve(Modules.NOTIFICATION)

  const orderId = data.id

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
      id: [orderId] 
    }
  })

  const order = orders[0]
  if (!order) return

  // 1.5. Idempotency Check: Don't generate if invoice already exists
  const existingDocs = await documentModuleService.listDocuments({ order_id: orderId, type: "invoice" })
  if (existingDocs.length > 0) {
    logger.info(`[Documents] Invoice already exists for order #${order.display_id}, skipping generation.`)
    return
  }

  // 2. Fetch Branding Settings
  const [settings] = await documentModuleService.listDocumentSettings({}, { take: 1 })
  const activeSettings = settings || { store_name: "My Store", primary_color: "#111827" }

  // 3. Generate and Save the "Invoice" (Unpaid version)
  const result = await documentModuleService.generateAndSaveInvoice(
    order,
    activeSettings,
    fileModuleService,
    activeSettings.template || "classic",
    "invoice" // Explicitly mark as invoice
  )

  logger.info(`[Documents] Auto-generated invoice for order #${order.display_id}`)

  // Determine subject based on event
  let subject = `Invoice for Order #${order.display_id}`
  if (name === "order.updated") {
    subject = `Updated Invoice for Order #${order.display_id}`
  } else if (name === "order.canceled") {
    subject = `Canceled Invoice for Order #${order.display_id}`
  }

  // 4. Send the Email with the Invoice Attached
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
    attachments:[
      {
        filename: `invoice-${order.display_id}.pdf`,
        content: result.buffer.toString("base64"),
        type: "application/pdf",
      },
    ],
  }

  if (activeSettings.company_email) {
    notificationData.cc = activeSettings.company_email
  }

  await notificationModuleService.createNotifications(notificationData)

  logger.info(`[Documents] Automatic invoice emailed to ${order.email}`)
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.updated", "order.canceled"],
}
