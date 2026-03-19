import { Container, Heading, Text, Button } from "@medusajs/ui"
import { DocumentsNav } from "../../../components/documents/nav"
import { CheckCircleSolid, Eye } from "@medusajs/icons"
import { useState, useEffect } from "react"

const templates = [
  { id: 'classic', name: 'Classic Professional', description: 'Standard business layout with clean lines.' },
  { id: 'modern', name: 'Modern Blue', description: 'Bold colors and a header bar for modern brands.' },
  { id: 'minimal', name: 'Minimalist', description: 'Simple text-based layout, great for thermal printers.' },
]

const TemplatesPage = () => {
  const [activeTemplate, setActiveTemplate] = useState('classic')

  // Load selection from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("preferred_template")
    if (saved) setActiveTemplate(saved)
  }, [])

  const handleSelect = (id: string) => {
    setActiveTemplate(id)
    localStorage.setItem("preferred_template", id)
  }

  const handlePreview = (id: string) => {
    // Open the preview in a new tab
    const previewUrl = `/admin/documents/generate/preview?template=${id}`
    window.open(previewUrl, '_blank')
  }

  return (
    <Container>
      <div className="flex flex-col gap-y-2 mb-8">
        <Heading level="h1">Documents</Heading>
        <p className="text-ui-fg-subtle text-small">Select a default design for your PDFs.</p>
      </div>

      <DocumentsNav />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates.map((t) => (
          <div 
            key={t.id} 
            className={`p-6 rounded-lg border-2 flex flex-col justify-between min-h-[220px] transition-all cursor-pointer ${
              activeTemplate === t.id ? "border-blue-500 bg-blue-50/30" : "border-ui-border-base bg-ui-bg-base hover:border-ui-border-strong"
            }`}
            onClick={() => handleSelect(t.id)}
          >
            <div>
              <div className="flex justify-between items-start">
                <Heading level="h2" className="text-base font-semibold">{t.name}</Heading>
                {activeTemplate === t.id && <CheckCircleSolid className="text-blue-500" />}
              </div>
              <Text className="text-ui-fg-subtle text-small mt-2">{t.description}</Text>
            </div>
            
            <div className="flex gap-x-2 mt-6">
              <Button 
                variant={activeTemplate === t.id ? "primary" : "secondary"} 
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect(t.id)
                }}
              >
                {activeTemplate === t.id ? "Selected" : "Select"}
              </Button>
              <Button 
                variant="transparent" 
                className="flex-1 border border-ui-border-base"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePreview(t.id)
                }}
              >
                <Eye /> Preview
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}

export default TemplatesPage
