import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type DocumentSettingsReq = {
  store_name?: string
  primary_color?: string
  // ... other fields
}

export const POST = async (req: MedusaRequest<DocumentSettingsReq>, res: MedusaResponse) => {
  const documentModuleService: any = req.scope.resolve("documents")
  
  // Find if settings already exist
  const [existing] = await documentModuleService.listDocumentSettings({}, { take: 1 })

  let settings
  if (existing) {
    // Update existing record
    settings = await documentModuleService.updateDocumentSettings({
      id: existing.id,
      ...req.body
    })
  } else {
    // Create first record with defaults if fields are missing
    settings = await documentModuleService.createDocumentSettings({
      store_name: req.body.store_name || "My Store",
      primary_color: req.body.primary_color || "#111827",
      ...req.body
    })
  }

  res.json({ settings })
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const documentModuleService: any = req.scope.resolve("documents")
  const [settings] = await documentModuleService.listDocumentSettings({}, { take: 1 })
  res.json({ settings: settings || null })
}
