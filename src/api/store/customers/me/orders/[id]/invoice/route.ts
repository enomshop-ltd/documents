import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params // The Order ID
  const documentModuleService: any = req.scope.resolve("documents")
  
  // 1. Verify the order belongs to the logged-in customer
  // req.auth_context.actor_id contains the logged-in customer ID
  // ✅ New v2 method
  const query = req.scope.resolve("query")
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["customer_id"],
    filters: {
      id: [id]
    }
  })

  const order = orders[0]

  if (!order) {
    return res.status(404).json({ message: "Order not found" })
  }

  if (order.customer_id !== (req as any).auth_context?.actor_id) {
    return res.status(403).json({ message: "Unauthorized" })
  }

  // 2. Fetch the document link from your module
  const [documents] = await documentModuleService.listDocuments({
    order_id: id,
    type: "invoice"
  })

  if (!documents.length) {
    return res.status(404).json({ message: "Invoice not generated yet" })
  }

  // 3. Return the URL
  res.json({ url: documents[0].file_key })
}
