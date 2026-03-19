import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Detailed mock data for the "Preview" button.
 */
const sampleOrder = {
  id: "order_12345",
  display_id: "12345",
  created_at: new Date("2026-03-09T10:07:29-07:00"),
  email: "preview-customer@example.com",
  currency_code: "kes",
  item_total: 8500,
  tax_total: 1500,
  total: 10000,
  summary: {
    item_total: 8500,
    tax_total: 1500,
    total: 10000,
  },
  payment_status: "captured", 
  status: "completed",
  items:[
    { title: "Medusa Premium Hoodie", quantity: 1, unit_price: 5000, total: 5000 },
    { title: "Medusa Coffee Mug", quantity: 2, unit_price: 1750, total: 3500 }
  ],
  billing_address: { 
    first_name: "John", 
    last_name: "Doe", 
    address_1: "123 Medusa Lane",
    city: "Nairobi",
    province: "Nairobi",
    postal_code: "00100"
  }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const template = (req.query.template as string) || "classic"
  const type = (req.query.type as string) || "invoice"
  
  const logger = req.scope.resolve("logger")
  const documentModuleService: any = req.scope.resolve("documents")
  const fileModuleService: any = req.scope.resolve(Modules.FILE)
  const notificationModuleService: any = req.scope.resolve(Modules.NOTIFICATION)

  const [dbSettings] = await documentModuleService.listDocumentSettings({}, { take: 1 })
  const settings = dbSettings || { store_name: "My Store", primary_color: "#111827" }

  if (id === "preview") {
    const pdfBuffer = await documentModuleService.pdfGenerator.generateInvoice(sampleOrder, settings, template, "receipt")
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename=preview.pdf')
    return res.status(200).send(pdfBuffer)
  }

  let orderData
  try {
    // 1. Resolve the top-level query engine instead of the order module
    const query = req.scope.resolve("query")
    
    // 2. Use query.graph to stitch the relations together
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
        "fulfillments.*",
        "summary.*"
      ],
      filters: {
        id: [id]
      }
    })

    if (!orders || orders.length === 0) {
      throw new Error("Order not found")
    }
    orderData = orders[0]
    
    logger.info(`[Documents] Loaded Order #${orderData.display_id} | Items: ${orderData.items?.length || 0} | Has Address: ${!!orderData.billing_address}`)
  } catch (e) {
    logger.error(`[Documents] Order ${id} not found: ${(e as Error).message}`)
    return res.status(404).json({ message: "Order not found" })
  }

  try {
    const existingDocs = await documentModuleService.listDocuments({ order_id: id, type: type })
    if (existingDocs.length > 0) {
      for (const doc of existingDocs) {
        await documentModuleService.deleteDocuments(doc.id)
      }
    }

    const result = await documentModuleService.generateAndSaveInvoice(
      orderData, 
      settings, 
      fileModuleService,
      template,
      type
    )

    if (type === "receipt") {
      try {
        await notificationModuleService.createNotifications({
          to: orderData.email,
          channel: "email",
          template: "invoice-template", 
          data: {
            order_id: orderData.display_id,
            customer_name: orderData.billing_address?.first_name || "Customer",
            store_name: settings.store_name,
            subject: `Receipt for Order #${orderData.display_id}`,
          },
          attachments:[
            {
              filename: `receipt-${orderData.display_id}.pdf`,
              content: result.buffer.toString("base64"),
              type: "application/pdf",
            },
          ],
        })
      } catch (emailErr) {
        logger.error(`[Documents] Email failed: ${(emailErr as Error).message}`)
      }
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', result.buffer.length)
    res.setHeader('Content-Disposition', `attachment; filename=${type}-${orderData.display_id}.pdf`)
    
    return res.status(200).send(result.buffer)

  } catch (genErr) {
    logger.error(`[Documents] Critical Failure: ${(genErr as Error).message}`)
    return res.status(500).json({ message: "PDF Generation failed" })
  }
}
