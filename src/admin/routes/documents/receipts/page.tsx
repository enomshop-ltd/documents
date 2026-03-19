import { 
  Container, 
  Heading, 
  Table, 
  StatusBadge, 
  IconButton, 
  Tooltip 
} from "@medusajs/ui"
import { 
  ArrowDownTray, 
  CheckCircleSolid, 
  DocumentText,
  Spinner // Correctly moved to icons
} from "@medusajs/icons"
import { useEffect, useState } from "react"
import { sdk } from "../../../lib/sdk"
import { DocumentsNav } from "../../../components/documents/nav"

// Helper to format currency
const formatAmount = (amount: number, currencyCode?: string) => {
  const safeCode = (currencyCode || "KES").toUpperCase()
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: safeCode,
  }).format((amount || 0))
}

const ReceiptsPage = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    try {
      // 1. Fetch orders with necessary name fields
      const orderRes = await sdk.admin.order.list({ 
        fields: "*shipping_address,*billing_address,*payment_collections,*summary" 
      })
      
      // 2. Fetch only documents of type 'receipt'
      const docRes = await fetch("/admin/documents?type=receipt")
      const docData = await docRes.json()

      setOrders(orderRes.orders || [])
      setDocuments(docData.documents || [])
    } catch (e) {
      console.error("Failed to fetch receipts:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <Container>
      <div className="flex flex-col gap-y-2 mb-8">
        <Heading level="h1">Receipts</Heading>
        <p className="text-ui-fg-subtle text-small">
          View and download proof of payment for captured orders.
        </p>
      </div>

      <DocumentsNav />
      
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Spinner className="animate-spin" />
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Order</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Customer</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Receipt</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {orders.map((order) => {
              // Find the receipt document for this order
              const receipt = documents.find(d => d.order_id === order.id)
              
              // Only show orders that are either PAID or have a generated receipt
              const isPaid = order.payment_status === 'captured' || order.payment_collections?.some((pc: any) => pc.status === 'captured')
              if (!receipt && !isPaid) {
                return null
              }

              const customerName = `${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`.trim() || order.email

              return (
                <Table.Row key={order.id}>
                  <Table.Cell className="font-medium text-ui-fg-base">
                    #{order.display_id}
                  </Table.Cell>
                  
                  <Table.Cell>
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </Table.Cell>

                  <Table.Cell>{customerName}</Table.Cell>

                  <Table.Cell>
                    <StatusBadge color="green">Paid</StatusBadge>
                  </Table.Cell>

                  <Table.Cell>
                    {receipt ? (
                      <Tooltip content="Receipt generated">
                        <CheckCircleSolid className="text-ui-fg-success" />
                      </Tooltip>
                    ) : (
                      <span className="text-ui-fg-muted italic text-small">Pending</span>
                    )}
                  </Table.Cell>

                  <Table.Cell className="text-right">
                    {formatAmount(order.summary?.total ?? order.total, order.currency_code)}
                  </Table.Cell>

                  <Table.Cell className="text-right">
                    {receipt && (
                      <Tooltip content="Download Receipt">
                        <IconButton variant="transparent" size="small" asChild>
                          <a href={receipt.file_key} target="_blank" rel="noreferrer">
                            <ArrowDownTray />
                          </a>
                        </IconButton>
                      </Tooltip>
                    )}
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export default ReceiptsPage
