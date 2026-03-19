import { defineRouteConfig } from "@medusajs/admin-sdk"
import { 
  Container, 
  Heading, 
  Table, 
  StatusBadge, 
  IconButton, 
  Tooltip, 
  toast, 
  Input 
} from "@medusajs/ui"
import { 
  DocumentText, 
  ArrowDownTray, 
  CheckCircleSolid, 
  ArrowPath, 
  CreditCard,
  Spinner 
} from "@medusajs/icons"
import { useEffect, useState, useMemo } from "react"
import { sdk } from "../../lib/sdk"
import { DocumentsNav } from "../../components/documents/nav"

const PAGE_SIZE = 10

const formatAmount = (amount: number, currencyCode?: string) => {
  const safeCode = (currencyCode || "KES").toUpperCase()
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: safeCode,
  }).format((amount || 0))
}

const DocumentsOrdersPage = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  
  const [currentPage, setCurrentPage] = useState(0)
  const [count, setCount] = useState(0)
  const [searchValue, setSearchValue] = useState("")

  const fetchData = async () => {
    try {
      const orderResponse = await sdk.admin.order.list({ 
        fields: "*shipping_address,*billing_address,*payment_collections,*summary",
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
        q: searchValue || undefined
      })
      
      const docData = await sdk.client.fetch("/admin/documents", { method: "GET"})
      const data = docData as { documents: any[] }

      setOrders(orderResponse.orders || [])
      setCount(orderResponse.count || 0)
      setDocuments(data.documents || [])
    } catch (error) { 
      toast.error("Failed to load orders or documents")
    } finally { 
      setIsLoading(false) 
    }
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData()
    }, searchValue ? 500 : 0)
    return () => clearTimeout(delayDebounceFn)
  }, [currentPage, searchValue])

  const handleAction = async (id: string, type: "invoice" | "receipt", displayId: string) => {
    setIsGenerating(`${id}-${type}`)
    try {
      const template = localStorage.getItem("preferred_template") || "classic"
      
      // 1. Fetch the PDF from the API
      const response = await fetch(`/admin/documents/generate/${id}?template=${template}&type=${type}`)
      
      if (!response.ok) throw new Error("API Error")

      // 2. TRIGGER AUTO-DOWNLOAD
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${type}-${displayId}.pdf`)
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)

      // 3. UI Feedback
      toast.success(
        type === "receipt" 
          ? `Receipt for #${displayId} sent and downloaded` 
          : `Invoice for #${displayId} generated and downloaded`
      )
      
      fetchData()
    } catch (e) {
      toast.error(`Failed to process ${type}`)
    } finally {
      setIsGenerating(null)
    }
  }

  const pageCount = useMemo(() => Math.ceil(count / PAGE_SIZE), [count])

  return (
    <Container>
      <div className="flex flex-col gap-y-2 mb-8">
        <Heading level="h1">Documents</Heading>
        <p className="text-ui-fg-subtle text-small">
          Manage invoices and manually trigger receipts for your orders.
        </p>
      </div>

      {/* TABS & SEARCH ROW */}
      <div className="relative flex items-center justify-between">
        <div className="flex-1">
          <DocumentsNav />
        </div>
        {/* Smaller search input, flushed right, 160px width */}
        <div className="w-[160px] mb-6">
          <Input
            type="search"
            size="small"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => {
                setSearchValue(e.target.value)
                setCurrentPage(0)
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner className="animate-spin" />
        </div>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Order</Table.HeaderCell>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Payment Status</Table.HeaderCell>
                <Table.HeaderCell>Documents Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {orders.map((order) => {
                const invoice = documents.find(d => d.order_id === order.id && d.type === 'invoice')
                const receipt = documents.find(d => d.order_id === order.id && d.type === 'receipt')
                const isPaid = order.payment_status === "captured" || order.payment_collections?.some((pc: any) => pc.status === "captured")
                
                const firstName = order.shipping_address?.first_name || order.billing_address?.first_name || ""
                const lastName = order.shipping_address?.last_name || order.billing_address?.last_name || ""
                const fullName = `${firstName} ${lastName}`.trim()
                const customerDisplay = fullName || order.email || "Guest"

                return (
                  <Table.Row key={order.id}>
                    <Table.Cell className="font-medium text-ui-fg-base">#{order.display_id}</Table.Cell>
                    
                    <Table.Cell>
                      {new Date(order.created_at).toLocaleDateString("en-US", { 
                        month: "short", day: "numeric", year: "numeric" 
                      })}
                    </Table.Cell>

                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="text-ui-fg-base">{customerDisplay}</span>
                        {fullName && <span className="text-ui-fg-subtle text-small">{order.email}</span>}
                      </div>
                    </Table.Cell>

                    <Table.Cell>
                      <StatusBadge color={isPaid ? "green" : "orange"}>{order.payment_status}</StatusBadge>
                    </Table.Cell>

                    <Table.Cell>
                      <div className="flex gap-x-2">
                         {invoice && (
                           <Tooltip content="Invoice Generated">
                             <CheckCircleSolid className="text-ui-fg-success" />
                           </Tooltip>
                         )}
                         {receipt && (
                           <Tooltip content="Receipt Emailed">
                             <CreditCard className="text-ui-fg-blue" />
                           </Tooltip>
                         )}
                      </div>
                    </Table.Cell>

                    <Table.Cell className="text-right font-medium">
                      {formatAmount(order.summary?.total ?? order.total, order.currency_code)}
                    </Table.Cell>

                    <Table.Cell>
                      <div className="flex justify-end gap-x-2">
                        {invoice && (
                          <Tooltip content="Download Invoice">
                            <IconButton variant="transparent" size="small" asChild>
                              <a href={invoice.file_key} target="_blank" rel="noreferrer"><ArrowDownTray /></a>
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip content={invoice ? "Regenerate Invoice" : "Generate Invoice"}>
                          <IconButton 
                            variant={invoice ? "transparent" : "primary"} 
                            size="small"
                            isLoading={isGenerating === `${order.id}-invoice`}
                            onClick={() => handleAction(order.id, "invoice", order.display_id)}
                          >
                            {invoice ? <ArrowPath /> : <DocumentText />}
                          </IconButton>
                        </Tooltip>
                        {isPaid && (
                          <Tooltip content={receipt ? "Resend Receipt" : "Send Receipt"}>
                            <IconButton 
                              variant="transparent" 
                              size="small"
                              className="text-ui-fg-blue"
                              isLoading={isGenerating === `${order.id}-receipt`}
                              onClick={() => handleAction(order.id, "receipt", order.display_id)}
                            >
                              <CreditCard />
                            </IconButton>
                          </Tooltip>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>

          <Table.Pagination
            count={count}
            pageSize={PAGE_SIZE}
            pageIndex={currentPage}
            pageCount={pageCount}
            canPreviousPage={currentPage > 0}
            canNextPage={currentPage < pageCount - 1}
            previousPage={() => setCurrentPage(prev => prev - 1)}
            nextPage={() => setCurrentPage(prev => prev + 1)}
          />
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Documents", icon: DocumentText, nested: "/orders" })
export default DocumentsOrdersPage
