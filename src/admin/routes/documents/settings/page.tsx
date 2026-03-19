import { Container, Heading, Input, Label, Button, Text } from "@medusajs/ui"
import { useState, useEffect } from "react"
import { DocumentsNav } from "../../../components/documents/nav"
import { sdk } from "../../../lib/sdk"

const DocumentSettingsPage = () => {
  const [settings, setSettings] = useState({
    store_name: "",
    primary_color: "#111827",
    logo_url: "",
    address: "",
    terms: "",
    bank_details: "",
    invoice_prefix: "INV-",
    company_email: ""
  })

  useEffect(() => {
    sdk.client.fetch("/admin/documents/settings", { method: "GET" })
      .then((data: any) => {
        if (data.settings) {
          setSettings({
            store_name: data.settings.store_name ?? "",
            primary_color: data.settings.primary_color ?? "#111827",
            logo_url: data.settings.logo_url ?? "",
            address: data.settings.address ?? "",
            terms: data.settings.terms ?? "",
            bank_details: data.settings.bank_details ?? "",
            invoice_prefix: data.settings.invoice_prefix ?? "INV-",
            company_email: data.settings.company_email ?? ""
          })
        }
      })
      .catch(e => console.error("Failed to load settings:", e))
  }, [])

  const handleSave = async () => {
    try {
      await sdk.client.fetch("/admin/documents/settings", {
        method: "POST",
        body: settings // SDK automatically stringifies the body
      })
      alert("Settings saved successfully!")
    } catch (e) {
      alert("Failed to save.")
    }
  }

  return (
    <Container>
      {/* Heading and Description Section */}
      <div className="flex flex-col gap-y-2 mb-8">
        <Heading level="h1">Document Settings</Heading>
        <Text className="text-ui-fg-subtle text-small">
          Configure your store branding, contact information, bank details, and legal terms for all generated PDF invoices.
        </Text>
      </div>

      <DocumentsNav />
      
      <div className="max-w-[600px] flex flex-col gap-y-8">
        {/* Store Name & Branding */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-2">
            <Label>Store Name</Label>
            <Input 
              value={settings.store_name} 
              onChange={(e) => setSettings({...settings, store_name: e.target.value})} 
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Primary Brand Color</Label>
            <div className="flex gap-x-2">
              <input 
                type="color" 
                className="w-10 h-10 p-0 border rounded cursor-pointer"
                value={settings.primary_color} 
                onChange={(e) => setSettings({...settings, primary_color: e.target.value})} 
              />
              <Input 
                value={settings.primary_color} 
                onChange={(e) => setSettings({...settings, primary_color: e.target.value})} 
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-2">
            <Label>Logo URL</Label>
            <Input 
              placeholder="https://example.com/logo.png"
              value={settings.logo_url} 
              onChange={(e) => setSettings({...settings, logo_url: e.target.value})} 
            />
            <Text className="text-ui-fg-subtle text-xs">
              Provide a direct URL to a PNG or JPEG image.
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Company Email</Label>
            <Input 
              type="email"
              placeholder="billing@example.com"
              value={settings.company_email} 
              onChange={(e) => setSettings({...settings, company_email: e.target.value})} 
            />
            <Text className="text-ui-fg-subtle text-xs">
              Used as CC for automated emails.
            </Text>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-y-2">
            <Label>Invoice Prefix</Label>
            <Input 
              placeholder="INV-"
              value={settings.invoice_prefix} 
              onChange={(e) => setSettings({...settings, invoice_prefix: e.target.value})} 
            />
            <Text className="text-ui-fg-subtle text-xs">
              Used to generate invoice numbers (e.g. INV-202603-12345).
            </Text>
          </div>
        </div>

        <div className="flex flex-col gap-y-2">
          <Label>Header Address</Label>
          <textarea 
            className="min-h-[80px] p-3 border rounded-md bg-ui-bg-field text-ui-fg-base text-small"
            placeholder="Your business address as it should appear on the invoice header..."
            value={settings.address} 
            onChange={(e) => setSettings({...settings, address: e.target.value})} 
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label>Terms & Conditions</Label>
          <textarea 
            className="min-h-[120px] p-3 border rounded-md bg-ui-bg-field text-ui-fg-base text-small"
            placeholder="e.g. Payment is due within 15 days. Please include order number in transfer reference."
            value={settings.terms} 
            onChange={(e) => setSettings({...settings, terms: e.target.value})} 
          />
        </div>

        <div className="flex flex-col gap-y-2">
          <Label>Bank Details</Label>
          <textarea 
            className="min-h-[120px] p-3 border rounded-md bg-ui-bg-field text-ui-fg-base text-small"
            placeholder="Name of Bank: ...&#10;Account Number: ...&#10;Routing/Swift: ..."
            value={settings.bank_details} 
            onChange={(e) => setSettings({...settings, bank_details: e.target.value})} 
          />
        </div>

        <Button onClick={handleSave} size="large" className="w-full">Save Changes</Button>
      </div>
    </Container>
  )
}

export default DocumentSettingsPage
