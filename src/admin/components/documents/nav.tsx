import { Tabs } from "@medusajs/ui"
import { useNavigate, useLocation } from "react-router-dom"

export const DocumentsNav = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const activeTab = location.pathname.includes("/templates") 
      ? "templates" 
      : location.pathname.includes("/settings") 
        ? "settings" 
        : "invoices"

  return (
    <div className="mb-6">
      <Tabs 
        value={activeTab} 
        onValueChange={(v) => {
          const path = v === "invoices" ? "" : `/${v}`
          navigate(`/documents${path}`) 
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="invoices">Invoices</Tabs.Trigger>
          <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
          <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
        </Tabs.List>
      </Tabs>
    </div>
  )
}
