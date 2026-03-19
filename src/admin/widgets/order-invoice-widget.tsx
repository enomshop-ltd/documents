import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"
import { Container, Heading, Button, toast, IconButton, Tooltip } from "@medusajs/ui"
import { DocumentText, ArrowDownTray, CreditCard, ArrowPath } from "@medusajs/icons"
import { useState, useEffect } from "react"

const OrderInvoiceWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [invoiceDoc, setInvoiceDoc] = useState<any>(null)
  const [receiptDoc, setReceiptDoc] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)

  const isPaid = order.payment_status === "captured" || order.payment_collections?.some((pc: any) => pc.status === "captured")

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/admin/documents")
      const data = await response.json()
      
      const inv = data.documents?.find((d: any) => d.order_id === order.id && d.type === "invoice")
      const rcp = data.documents?.find((d: any) => d.order_id === order.id && d.type === "receipt")
      
      setInvoiceDoc(inv)
      setReceiptDoc(rcp)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [order.id])

  const handleAction = async (type: "invoice" | "receipt") => {
    setIsGenerating(type)
    try {
      const template = localStorage.getItem("preferred_template") || "classic"
      
      // 1. Fetch the PDF
      const response = await fetch(`/admin/documents/generate/${order.id}?template=${template}&type=${type}`)
      
      if (!response.ok) throw new Error("API Error")

      // 2. TRIGGER AUTO-DOWNLOAD
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${type}-${order.display_id}.pdf`)
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)

      // 3. UI Feedback
      toast.success(type === "receipt" ? "Receipt sent & downloaded" : "Invoice downloaded")
      
      await fetchDocuments()
    } catch (e) {
      toast.error(`Failed to process ${type}`)
    } finally {
      setIsGenerating(null)
    }
  }

  return (
    <Container className="p-0 overflow-hidden">
      {/* 
         Grid layout: 
         - 1 column if not paid (Invoice takes full width)
         - 2 columns if paid (Invoice left, Receipt right)
      */}
      <div className={`grid ${isPaid ? "grid-cols-2 divide-x" : "grid-cols-1"}`}>
        
        {/* LEFT COLUMN: INVOICE */}
        <div className="flex flex-col gap-y-3 p-4">
          <div className="flex items-center gap-x-2">
            <DocumentText className="text-ui-fg-subtle h-4 w-4" />
            <Heading level="h3" className="text-xs font-bold uppercase tracking-wider text-ui-fg-muted">
              Invoice
            </Heading>
          </div>
          
          <div className="flex items-center gap-x-1">
            <Button 
              variant={invoiceDoc ? "transparent" : "primary"} 
              size="small" 
              className="flex-1 text-[11px] px-2"
              onClick={() => handleAction("invoice")}
              isLoading={isGenerating === "invoice"}
            >
              {invoiceDoc ? <ArrowPath /> : <DocumentText />}
              {invoiceDoc ? "Regen" : "Generate"}
            </Button>

            {invoiceDoc && (
              <Tooltip content="Download">
                <IconButton variant="transparent" asChild>
                  <a href={invoiceDoc.file_key} target="_blank" rel="noreferrer" title="Download" className="h-4 w-4">
                    <ArrowDownTray />
                  </a>
                </IconButton>
              </Tooltip>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RECEIPT (Only if Paid) */}
        {isPaid && (
          <div className="flex flex-col gap-y-3 p-4 bg-blue-50/20">
            <div className="flex items-center gap-x-2">
              <CreditCard className="text-ui-fg-blue h-4 w-4" />
              <Heading level="h3" className="text-xs font-bold uppercase tracking-wider text-ui-fg-blue">
                Receipt
              </Heading>
            </div>

            <div className="flex items-center gap-x-1">
              <Button 
                variant="secondary" 
                size="small" 
                className="flex-1 text-[11px] px-2 text-ui-fg-blue border-blue-200"
                onClick={() => handleAction("receipt")}
                isLoading={isGenerating === "receipt"}
              >
                {receiptDoc ? <ArrowPath /> : <CreditCard />}
                {receiptDoc ? "Resend" : "Send"}
              </Button>

              {receiptDoc && (
                <Tooltip content="Download">
                  <IconButton variant="transparent" className="border-blue-200" asChild>
                    <a href={receiptDoc.file_key} target="_blank" rel="noreferrer" title="Download">
                      <ArrowDownTray className="text-ui-fg-blue" />
                    </a>
                  </IconButton>
                </Tooltip>
              )}
            </div>
          </div>
        )}

      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after", // Sidebar
})

export default OrderInvoiceWidget
