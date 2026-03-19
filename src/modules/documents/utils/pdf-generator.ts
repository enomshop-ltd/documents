import PDFDocument from 'pdfkit'
import { invoiceTemplates } from './pdf-templates'

export class PDFGenerator {
  async generateInvoice(
    order: any, 
    settings: any, 
    templateId: string = 'classic',
    type: string = 'invoice' // Added this
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
        const buffers: Buffer[] = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('end', () => resolve(Buffer.concat(buffers)))

        const templateFn = invoiceTemplates[templateId as keyof typeof invoiceTemplates] 
          || invoiceTemplates.classic

        // Pass 'type' to the template function here
        await templateFn(doc, order, settings, type)

        doc.end()
      } catch (err) {
        reject(err)
      }
    })
  }
}
