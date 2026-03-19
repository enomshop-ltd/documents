import { MedusaService } from "@medusajs/framework/utils"
import * as Models from "./models"
import { PDFGenerator } from "./utils/pdf-generator"

class DocumentModuleService extends MedusaService(Models) {
  public pdfGenerator: PDFGenerator

  constructor(...args: any[]) {
    // @ts-ignore
    super(...args)
    this.pdfGenerator = new PDFGenerator()
  }

  async generateAndSaveInvoice(
    order: any, 
    settings: any, 
    fileModuleService: any, 
    templateId: string = 'classic', 
    type: string = 'invoice'
  ) {
    // Pass 'type' into the generator
    const pdfBuffer = await this.pdfGenerator.generateInvoice(order, settings, templateId, type)

    const [uploadedFile] = await fileModuleService.createFiles([{
      filename: `${type}-${order.display_id}.pdf`,
      content: pdfBuffer.toString("base64"),
      mimeType: "application/pdf"
    }])

    const prefix = type === 'invoice' ? (settings?.invoice_prefix || 'INV-') : 'RCP-';
    const date = new Date(order.created_at || Date.now());
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const cleanOrderId = order.display_id ? order.display_id.toString().replace(/^order_/, '') : (order.id || '').replace(/^order_/, '');
    const baseNumber = `${prefix}${dateStr}-${cleanOrderId}`;

    const docRecord = await this.createDocuments({
      type: type as any ,
      order_id: order.id,
      file_key: uploadedFile.url,
      // Add a timestamp to the document number to ensure it is always unique for that order
      document_number: `${baseNumber}-${Date.now().toString().slice(-6)}`
    })

    return { buffer: pdfBuffer, url: uploadedFile.url, record: docRecord }
  }
}

export default DocumentModuleService
