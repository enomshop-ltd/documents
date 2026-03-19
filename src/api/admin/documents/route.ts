import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const documentModuleService: any = req.scope.resolve("documents")
  
  // Get 'type' from query params (e.g., /admin/documents?type=receipt)
  const type = req.query.type as string

  const filter = type ? { type } : {}

  const documents = await documentModuleService.listDocuments(filter, {
    select: ["order_id", "file_key", "document_number", "type"]
  })

  res.json({ documents })
}
