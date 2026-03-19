import PDFDocument from 'pdfkit'

const formatCurrency = (amount: number, currency?: string) => {
  // Default to KES to ensure local transactions render correctly if data is missing
  const safeCurrency = (currency || "KES").toUpperCase()
  
  return new Intl.NumberFormat('en-KE', {
    style: "currency",
    currency: safeCurrency,
  }).format((amount || 0))
}

const drawTableHeader = (doc: any, y: number, margin: number, brandColor: string) => {
  const colQty = 50, colDesc = 280, colPrice = 80, colAmount = 90
  doc.rect(margin, y, 500, 24).fill(brandColor)
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9)
  doc.text("QTY", margin + 10, y + 8)
  doc.text("DESCRIPTION", margin + colQty + 10, y + 8)
  doc.text("UNIT PRICE", margin + colQty + colDesc, y + 8, { width: colPrice, align: 'center' })
  doc.text("AMOUNT", margin + colQty + colDesc + colPrice, y + 8, { width: colAmount, align: 'center' })
  return y + 24
}

const drawWatermark = (doc: any, text: string = "PAID") => {
  doc.save()
  doc.fillColor("#be185d").fillOpacity(0.06) 
  doc.translate(300, 400).rotate(-45)
  const fontSize = text.length > 10 ? 70 : 140
  doc.fontSize(fontSize).font("Helvetica-Bold").text(text, -200, -50, { align: 'center', width: 400 })
  doc.restore()
}

export const invoiceTemplates = {
  classic: async (doc: any, order: any, settings: any, type: string = "invoice") => {
    // 1. DATA SAFETY CHECKS
    const items = order?.items ||[]
    const billingAddress = order?.billing_address
    const margin = 50
    const tableWidth = 500
    const pageBottomThreshold = 700 
    const brandColor = settings.primary_color || "#111827"

    let totalRefunded = 0;
    if (order?.payment_collections) {
      order.payment_collections.forEach((pc: any) => {
        if (pc.payments) {
          pc.payments.forEach((p: any) => {
            if (p.refunds) {
              p.refunds.forEach((r: any) => {
                totalRefunded += (r.amount || 0);
              });
            }
          });
        }
      });
    }
    if (order?.refunds) {
      order.refunds.forEach((r: any) => {
        totalRefunded += (r.amount || 0);
      });
    }
    if (order?.summary?.refunded_total) {
      totalRefunded = Math.max(totalRefunded, order.summary.refunded_total);
    }

    // 2. ROBUST PAID CHECK
    const hasCapturedCollection = order?.payment_collections?.some(
      (pc: any) => pc.status === "captured" || pc.payments?.some((p: any) => p.captured_at)
    );
    
    const isPaid = !!(
      type === "receipt" || 
      order?.payment_status === "captured" || 
      order?.payment_status === "paid" || 
      order?.status === "completed" || 
      hasCapturedCollection
    );

    let documentTitle = "INVOICE"
    let watermarkText = ""
    let showWatermark = false

    if (type === "receipt") documentTitle = "RECEIPT"
    if (type === "credit_note") documentTitle = "CREDIT NOTE"

    const isFullyRefunded = order?.payment_status === "refunded" || (totalRefunded > 0 && totalRefunded >= (order?.total || 0));
    const isPartiallyRefunded = order?.payment_status === "partially_refunded" || (totalRefunded > 0 && totalRefunded < (order?.total || 0));

    // Evaluate order status first (Canceled takes precedence)
    if (order?.status === "canceled" || order?.payment_status === "canceled") {
      watermarkText = "CANCELLED"
      showWatermark = true
    } else if (isFullyRefunded || type === "credit_note") {
      // If it's fully refunded, or explicitly generated as a credit note
      watermarkText = "REFUNDED"
      showWatermark = true
    } else if (isPartiallyRefunded) {
      watermarkText = "PARTIAL REFUND"
      showWatermark = true
    } else if (isPaid) {
      // Only show PAID if it's actually paid and not cancelled/refunded
      watermarkText = "PAID"
      showWatermark = true
    }

    console.log(`[PDF-GEN] Order:${order?.display_id} | Paid:${isPaid} | ItemsCount:${items.length} | HasAddr:${!!billingAddress}`);

    if (showWatermark) drawWatermark(doc, watermarkText)

    // 3. HEADER & BRANDING
    doc.rect(0, 0, 600, 8).fill(brandColor) // Top accent bar
    
    // Logo Placeholder or Image
    if (settings.logo_url) {
      try {
        const response = await fetch(settings.logo_url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          doc.image(buffer, margin, 35, { fit: [60, 60], align: 'center', valign: 'center' });
        } else {
          throw new Error('Failed to fetch logo');
        }
      } catch (err) {
        console.error("Failed to load logo", err);
        doc.rect(margin, 35, 60, 60).fill("#f3f4f6").stroke("#e5e7eb")
        doc.fillColor("#9ca3af").font("Helvetica-Bold").fontSize(10).text("LOGO", margin + 14, 60)
      }
    } else {
      doc.rect(margin, 35, 60, 60).fill("#f3f4f6").stroke("#e5e7eb")
      doc.fillColor("#9ca3af").font("Helvetica-Bold").fontSize(10).text("LOGO", margin + 14, 60)
    }

    doc.fillColor(brandColor).fontSize(26).font("Helvetica-Bold").text(settings.store_name || "Store Name", margin + 80, 35)
    doc.fillColor("#4b5563").fontSize(10).font("Helvetica").text(settings.address || "", margin + 80, 65, { width: 200 })
    
    const prefix = settings.invoice_prefix || "INV-"
    const dateStr = new Date(order?.created_at || Date.now()).toISOString().slice(0, 7).replace('-', '') // YYYYMM
    const orderIdStr = order?.display_id ? String(order.display_id).replace(/^order_/, '') : (order?.id ? String(order.id).replace(/^order_/, '') : "N/A")
    const invoiceNumber = `${prefix}${dateStr}-${orderIdStr}`

    doc.fillColor(brandColor).fontSize(24).font("Helvetica-Bold").text(documentTitle, 400, 35, { align: 'right' })
    doc.fillColor("#6b7280").fontSize(10).font("Helvetica").text(`Date: ${new Date(order?.created_at || Date.now()).toLocaleDateString()}`, 400, 65, { align: 'right' })
    doc.text(`No: ${invoiceNumber}`, 400, 80, { align: 'right' })

    // 4. INFO GRID (BILL TO)
    const gridY = 130
    doc.rect(margin, gridY - 10, tableWidth, 20).fill("#f9fafb")
    doc.fillColor(brandColor).fontSize(10).font("Helvetica-Bold").text("BILL TO", margin + 10, gridY - 4)
    
    if (billingAddress) {
      const name = `${billingAddress.first_name || ""} ${billingAddress.last_name || ""}`.trim()
      const lines =[
        name || order?.customer?.first_name || "Valued Customer",
        billingAddress.company,
        billingAddress.address_1,
        billingAddress.address_2,
        `${billingAddress.city || ""} ${billingAddress.postal_code || ""}`.trim(),
        billingAddress.country_code?.toUpperCase()
      ].filter(Boolean)

      doc.fillColor("#374151").font("Helvetica")
      lines.forEach((line, index) => {
        doc.text(line, margin + 10, gridY + 20 + (index * 14)) 
      })
    } else {
      doc.fillColor("#374151").font("Helvetica").text(order?.email || "No address provided", margin + 10, gridY + 20)
    }

    // 5. THE TABLE
    let currentY = 240
    currentY = drawTableHeader(doc, currentY, margin, brandColor)
    
    const colQty = 50, colDesc = 280, colPrice = 80, colAmount = 90
    const rowHeight = 30
    doc.font("Helvetica").fontSize(10)

    if (items.length === 0) {
      doc.fillColor("#374151").text("No items found for this order.", margin + 10, currentY + 10)
    }

    items.forEach((item: any, index: number) => {
      const textHeight = doc.heightOfString(item.title || "Product Item", { width: colDesc - 20 })
      const dynamicRowHeight = Math.max(rowHeight, textHeight + 20)

      if (currentY + dynamicRowHeight > pageBottomThreshold) {
        doc.addPage()
        if (isPaid) drawWatermark(doc)
        currentY = 50 
        currentY = drawTableHeader(doc, currentY, margin, brandColor)
        doc.font("Helvetica").fontSize(10)
      }

      // Alternating row colors
      if (index % 2 === 0) {
        doc.rect(margin, currentY, 500, dynamicRowHeight).fill("#f9fafb")
      }

      doc.fillColor("#374151")
      const unitPrice = item.unit_price || 0
      const totalAmount = item.total || (unitPrice * (item.quantity || 0))

      doc.text(item.quantity?.toString() || "0", margin + 10, currentY + 10)
      doc.text(item.title || "Product Item", margin + colQty + 10, currentY + 10, { width: colDesc - 20 })
      doc.text(formatCurrency(unitPrice, order?.currency_code), margin + colQty + colDesc, currentY + 10, { width: colPrice, align: 'center' })
      doc.text(formatCurrency(totalAmount, order?.currency_code), margin + colQty + colDesc + colPrice, currentY + 10, { width: colAmount, align: 'center' })
      
      currentY += dynamicRowHeight
    })

    // Draw bottom border for table
    doc.moveTo(margin, currentY).lineTo(margin + 500, currentY).lineWidth(1).strokeColor("#e5e7eb").stroke()

    // 6. TOTALS SECTION
    if (currentY > 600) { doc.addPage(); if (showWatermark) drawWatermark(doc, watermarkText); currentY = 50; }
    currentY += 20
    const totalsX = 350
    doc.fillColor("#374151").font("Helvetica").text("Subtotal", totalsX, currentY, { width: 100, align: 'right' })
    doc.text(formatCurrency(order?.summary?.item_total ?? order?.item_total ?? order?.summary?.total ?? order?.total, order?.currency_code), 460, currentY, { width: 90, align: 'right' })
    currentY += 20
    
    const taxTotal = order?.summary?.tax_total ?? order?.tax_total ?? 0;
    if (taxTotal > 0) {
      doc.text("Tax (VAT)", totalsX, currentY, { width: 100, align: 'right' })
      doc.text(formatCurrency(taxTotal, order?.currency_code), 460, currentY, { width: 90, align: 'right' })
      currentY += 20
    }

    // Add refunded amount if applicable
    if (totalRefunded > 0) {
      doc.fillColor("#ea580c").font("Helvetica-Bold").text("Refunded Amount", totalsX, currentY, { width: 100, align: 'right' })
      doc.text(`-${formatCurrency(totalRefunded, order?.currency_code)}`, 460, currentY, { width: 90, align: 'right' })
      currentY += 20
    }
    
    currentY += 10
    doc.rect(460, currentY - 10, 90, 35).fill(brandColor)
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(14)
    doc.text("TOTAL", totalsX, currentY, { width: 100, align: 'right' })
    doc.text(formatCurrency(order?.summary?.total ?? order?.total, order?.currency_code), 460, currentY, { width: 90, align: 'right' })

    // 7. FOOTER & DIGITAL STAMP
    let footerY = currentY + 60
    if (footerY > 700) { doc.addPage(); if (showWatermark) drawWatermark(doc, watermarkText); footerY = 50; }

    if (showWatermark) {
      let stampColor = "#15803d"
      let stampTitle = "DIGITALLY VERIFIED RECEIPT"
      let stampStatus = "Electronic Payment Captured"
      
      if (order?.status === "canceled" || order?.payment_status === "canceled") {
        stampColor = "#dc2626"
        stampTitle = "CANCELLED"
        stampStatus = `Cancelled on ${new Date(order.canceled_at || Date.now()).toLocaleDateString()}`
      } else if (type === "credit_note") {
        stampColor = "#2563eb"
        stampTitle = "CREDIT NOTE ISSUED"
        stampStatus = `Issued on ${new Date().toLocaleDateString()}`
      } else if (isFullyRefunded || isPartiallyRefunded) {
        stampColor = "#ea580c"
        stampTitle = "REFUND ISSUED"
        stampStatus = `Refunded on ${new Date().toLocaleDateString()}`
      }

      doc.fontSize(7).font("Helvetica")
      const transactionText = `Transaction: ${order?.id?.split('_').pop()?.toUpperCase() || "N/A"}`
      const transactionHeight = doc.heightOfString(transactionText, { width: 130 })
      const rectHeight = 45 + transactionHeight

      doc.rect(400, footerY - 10, 150, rectHeight).lineWidth(1).strokeColor(stampColor).stroke()
      doc.fillColor(stampColor).font("Helvetica-Bold").fontSize(8).text(stampTitle, 410, footerY)
      doc.fontSize(7).font("Helvetica").fillColor("#4b5563")
      doc.text(transactionText, 410, footerY + 15, { width: 130 })
      doc.text(`Verified: ${new Date().toUTCString()}`, 410, footerY + 15 + transactionHeight)
      doc.text(`Status: ${stampStatus}`, 410, footerY + 25 + transactionHeight)
    }

    doc.fillColor(brandColor).font("Helvetica-Bold").fontSize(10).text("Terms & Conditions", margin, footerY)
    doc.fillColor("#4b5563").font("Helvetica").fontSize(9).text(settings.terms || "Thank you for your business.", margin, footerY + 15, { width: 250, lineGap: 2 })
    if (settings.bank_details) {
      doc.fillColor(brandColor).font("Helvetica-Bold").text("Bank Details", margin, footerY + 60)
      doc.fillColor("#4b5563").font("Helvetica").fontSize(9).text(settings.bank_details, margin, footerY + 75, { width: 250, lineGap: 2 })
    }

    // 8. PAGE NUMBERING
    const range = doc.bufferedPageRange(); 
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#9ca3af").fontSize(8).text(`Page ${i + 1} of ${range.count}`, margin, 800, { align: "center", width: 500 });
    }
  },
  modern: async (doc: any, order: any, settings: any, type: string = "invoice") => {
    // 1. DATA SAFETY CHECKS
    const items = order?.items ||[]
    const billingAddress = order?.billing_address
    const margin = 50
    const tableWidth = 500
    const pageBottomThreshold = 700 
    const brandColor = settings.primary_color || "#3b82f6" // Default to a modern blue

    let totalRefunded = 0;
    if (order?.payment_collections) {
      order.payment_collections.forEach((pc: any) => {
        if (pc.payments) {
          pc.payments.forEach((p: any) => {
            if (p.refunds) {
              p.refunds.forEach((r: any) => {
                totalRefunded += (r.amount || 0);
              });
            }
          });
        }
      });
    }
    if (order?.refunds) {
      order.refunds.forEach((r: any) => {
        totalRefunded += (r.amount || 0);
      });
    }
    if (order?.summary?.refunded_total) {
      totalRefunded = Math.max(totalRefunded, order.summary.refunded_total);
    }

    // 2. ROBUST PAID CHECK
    const hasCapturedCollection = order?.payment_collections?.some(
      (pc: any) => pc.status === "captured" || pc.payments?.some((p: any) => p.captured_at)
    );
    
    const isPaid = !!(
      type === "receipt" || 
      order?.payment_status === "captured" || 
      order?.payment_status === "paid" || 
      order?.status === "completed" || 
      hasCapturedCollection
    );

    let documentTitle = "INVOICE"
    let watermarkText = ""
    let showWatermark = false

    if (type === "receipt") documentTitle = "RECEIPT"
    if (type === "credit_note") documentTitle = "CREDIT NOTE"

    const isFullyRefunded = order?.payment_status === "refunded" || (totalRefunded > 0 && totalRefunded >= (order?.total || 0));
    const isPartiallyRefunded = order?.payment_status === "partially_refunded" || (totalRefunded > 0 && totalRefunded < (order?.total || 0));

    if (order?.status === "canceled" || order?.payment_status === "canceled") {
      watermarkText = "CANCELLED"
      showWatermark = true
    } else if (isFullyRefunded || type === "credit_note") {
      watermarkText = "REFUNDED"
      showWatermark = true
    } else if (isPartiallyRefunded) {
      watermarkText = "PARTIAL REFUND"
      showWatermark = true
    } else if (isPaid) {
      watermarkText = "PAID"
      showWatermark = true
    }

    if (showWatermark) drawWatermark(doc, watermarkText)

    // 3. HEADER & BRANDING (Modern: Side accent, clean layout)
    doc.rect(0, 0, 15, 842).fill(brandColor) // Left accent bar full height
    
    // Logo Placeholder or Image
    if (settings.logo_url) {
      try {
        const response = await fetch(settings.logo_url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          doc.image(buffer, margin, 40, { fit: [80, 80], align: 'left', valign: 'top' });
        } else {
          throw new Error('Failed to fetch logo');
        }
      } catch (err) {
        doc.rect(margin, 40, 80, 80).fill("#f3f4f6").stroke("#e5e7eb")
        doc.fillColor("#9ca3af").font("Helvetica-Bold").fontSize(12).text("LOGO", margin + 22, 75)
      }
    } else {
      doc.rect(margin, 40, 80, 80).fill("#f3f4f6").stroke("#e5e7eb")
      doc.fillColor("#9ca3af").font("Helvetica-Bold").fontSize(12).text("LOGO", margin + 22, 75)
    }

    const prefix = settings.invoice_prefix || "INV-"
    const dateStr = new Date(order?.created_at || Date.now()).toISOString().slice(0, 7).replace('-', '') // YYYYMM
    const orderIdStr = order?.display_id ? String(order.display_id).replace(/^order_/, '') : (order?.id ? String(order.id).replace(/^order_/, '') : "N/A")
    const invoiceNumber = `${prefix}${dateStr}-${orderIdStr}`

    doc.fillColor(brandColor).fontSize(32).font("Helvetica-Bold").text(documentTitle, 350, 40, { align: 'right' })
    doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text(`No: ${invoiceNumber}`, 350, 80, { align: 'right' })
    doc.fillColor("#6b7280").fontSize(10).font("Helvetica").text(`Date: ${new Date(order?.created_at || Date.now()).toLocaleDateString()}`, 350, 95, { align: 'right' })

    // 4. INFO GRID
    const gridY = 150
    
    // From (Store)
    doc.fillColor("#9ca3af").fontSize(9).font("Helvetica-Bold").text("FROM", margin, gridY)
    doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text(settings.store_name || "Store Name", margin, gridY + 15)
    doc.fillColor("#4b5563").fontSize(10).font("Helvetica").text(settings.address || "", margin, gridY + 30, { width: 200 })

    // To (Customer)
    doc.fillColor("#9ca3af").fontSize(9).font("Helvetica-Bold").text("BILL TO", 300, gridY)
    if (billingAddress) {
      const name = `${billingAddress.first_name || ""} ${billingAddress.last_name || ""}`.trim()
      doc.fillColor("#111827").fontSize(12).font("Helvetica-Bold").text(name || order?.customer?.first_name || "Valued Customer", 300, gridY + 15)
      
      const lines =[
        billingAddress.company,
        billingAddress.address_1,
        billingAddress.address_2,
        `${billingAddress.city || ""} ${billingAddress.postal_code || ""}`.trim(),
        billingAddress.country_code?.toUpperCase()
      ].filter(Boolean)

      doc.fillColor("#4b5563").font("Helvetica").fontSize(10)
      lines.forEach((line, index) => {
        doc.text(line, 300, gridY + 30 + (index * 14)) 
      })
    } else {
      doc.fillColor("#4b5563").font("Helvetica").text(order?.email || "No address provided", 300, gridY + 15)
    }

    // 5. THE TABLE (Modern: Clean lines, no background header)
    let currentY = 280
    const colQty = 40, colDesc = 260, colPrice = 90, colAmount = 110
    
    // Header
    doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(2).strokeColor(brandColor).stroke()
    currentY += 10
    doc.fillColor(brandColor).font("Helvetica-Bold").fontSize(9)
    doc.text("QTY", margin, currentY)
    doc.text("ITEM DESCRIPTION", margin + colQty, currentY)
    doc.text("PRICE", margin + colQty + colDesc, currentY, { width: colPrice, align: 'right' })
    doc.text("TOTAL", margin + colQty + colDesc + colPrice, currentY, { width: colAmount, align: 'right' })
    currentY += 15
    doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(1).strokeColor("#e5e7eb").stroke()
    currentY += 15
    
    const rowHeight = 30
    doc.font("Helvetica").fontSize(10)

    if (items.length === 0) {
      doc.fillColor("#4b5563").text("No items found for this order.", margin, currentY)
    }

    items.forEach((item: any, index: number) => {
      const textHeight = doc.heightOfString(item.title || "Product Item", { width: colDesc - 20 })
      const dynamicRowHeight = Math.max(rowHeight, textHeight + 15)

      if (currentY + dynamicRowHeight > pageBottomThreshold) {
        doc.addPage()
        doc.rect(0, 0, 15, 842).fill(brandColor)
        if (isPaid) drawWatermark(doc)
        currentY = 50 
        
        // Redraw Header
        doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(2).strokeColor(brandColor).stroke()
        currentY += 10
        doc.fillColor(brandColor).font("Helvetica-Bold").fontSize(9)
        doc.text("QTY", margin, currentY)
        doc.text("ITEM DESCRIPTION", margin + colQty, currentY)
        doc.text("PRICE", margin + colQty + colDesc, currentY, { width: colPrice, align: 'right' })
        doc.text("TOTAL", margin + colQty + colDesc + colPrice, currentY, { width: colAmount, align: 'right' })
        currentY += 15
        doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(1).strokeColor("#e5e7eb").stroke()
        currentY += 15
        doc.font("Helvetica").fontSize(10)
      }

      doc.fillColor("#111827")
      const unitPrice = item.unit_price || 0
      const totalAmount = item.total || (unitPrice * (item.quantity || 0))

      doc.text(item.quantity?.toString() || "0", margin, currentY)
      doc.text(item.title || "Product Item", margin + colQty, currentY, { width: colDesc - 20 })
      doc.fillColor("#4b5563")
      doc.text(formatCurrency(unitPrice, order?.currency_code), margin + colQty + colDesc, currentY, { width: colPrice, align: 'right' })
      doc.fillColor("#111827").font("Helvetica-Bold")
      doc.text(formatCurrency(totalAmount, order?.currency_code), margin + colQty + colDesc + colPrice, currentY, { width: colAmount, align: 'right' })
      doc.font("Helvetica")
      
      currentY += dynamicRowHeight
      doc.moveTo(margin, currentY - 5).lineTo(margin + tableWidth, currentY - 5).lineWidth(0.5).strokeColor("#f3f4f6").stroke()
    })

    doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(2).strokeColor(brandColor).stroke()

    // 6. TOTALS SECTION
    if (currentY > 600) { doc.addPage(); doc.rect(0, 0, 15, 842).fill(brandColor); if (showWatermark) drawWatermark(doc, watermarkText); currentY = 50; }
    currentY += 20
    const totalsX = 350
    doc.fillColor("#4b5563").font("Helvetica").text("Subtotal", totalsX, currentY, { width: 100, align: 'right' })
    doc.fillColor("#111827").text(formatCurrency(order?.summary?.item_total ?? order?.item_total ?? order?.summary?.total ?? order?.total, order?.currency_code), 460, currentY, { width: 90, align: 'right' })
    currentY += 20
    
    const taxTotal = order?.summary?.tax_total ?? order?.tax_total ?? 0;
    if (taxTotal > 0) {
      doc.fillColor("#4b5563").text("Tax (VAT)", totalsX, currentY, { width: 100, align: 'right' })
      doc.fillColor("#111827").text(formatCurrency(taxTotal, order?.currency_code), 460, currentY, { width: 90, align: 'right' })
      currentY += 20
    }

    // Add refunded amount if applicable
    if (totalRefunded > 0) {
      doc.fillColor("#ea580c").font("Helvetica-Bold").text("Refunded Amount", totalsX, currentY, { width: 100, align: 'right' })
      doc.text(`-${formatCurrency(totalRefunded, order?.currency_code)}`, 460, currentY, { width: 90, align: 'right' })
      currentY += 20
    }
    
    currentY += 10
    doc.rect(totalsX + 10, currentY - 10, 190, 40).fill("#f9fafb").stroke(brandColor).lineWidth(1)
    doc.fillColor(brandColor).font("Helvetica-Bold").fontSize(14)
    doc.text("TOTAL", totalsX + 20, currentY + 5, { width: 80, align: 'left' })
    doc.text(formatCurrency(order?.summary?.total ?? order?.total, order?.currency_code), 460, currentY + 5, { width: 80, align: 'right' })

    // 7. FOOTER & DIGITAL STAMP
    let footerY = currentY + 70
    if (footerY > 700) { doc.addPage(); doc.rect(0, 0, 15, 842).fill(brandColor); if (showWatermark) drawWatermark(doc, watermarkText); footerY = 50; }

    if (showWatermark) {
      let stampColor = "#16a34a"
      let stampBg = "#f0fdf4"
      let stampTitle = "DIGITALLY VERIFIED"
      let stampStatus = "Paid in Full"
      
      if (order?.status === "canceled" || order?.payment_status === "canceled") {
        stampColor = "#dc2626"
        stampBg = "#fef2f2"
        stampTitle = "CANCELLED"
        stampStatus = `Cancelled on ${new Date(order.canceled_at || Date.now()).toLocaleDateString()}`
      } else if (type === "credit_note") {
        stampColor = "#2563eb"
        stampBg = "#eff6ff"
        stampTitle = "CREDIT NOTE ISSUED"
        stampStatus = `Issued on ${new Date().toLocaleDateString()}`
      } else if (isFullyRefunded || isPartiallyRefunded) {
        stampColor = "#ea580c"
        stampBg = "#fff7ed"
        stampTitle = "REFUND ISSUED"
        stampStatus = `Refunded on ${new Date().toLocaleDateString()}`
      }

      doc.fontSize(7).font("Helvetica")
      const transactionText = `Txn: ${order?.id?.split('_').pop()?.toUpperCase() || "N/A"}`
      const transactionHeight = doc.heightOfString(transactionText, { width: 130 })
      const rectHeight = 45 + transactionHeight

      doc.rect(400, footerY - 10, 150, rectHeight).fill(stampBg).stroke(stampColor).lineWidth(1)
      doc.fillColor(stampColor).font("Helvetica-Bold").fontSize(8).text(stampTitle, 410, footerY)
      doc.fontSize(7).font("Helvetica").fillColor(stampColor)
      doc.text(transactionText, 410, footerY + 15, { width: 130 })
      doc.text(`Date: ${new Date().toUTCString()}`, 410, footerY + 15 + transactionHeight)
      doc.text(`Status: ${stampStatus}`, 410, footerY + 25 + transactionHeight)
    }

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text("Terms & Conditions", margin, footerY)
    doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(settings.terms || "Thank you for your business.", margin, footerY + 15, { width: 250, lineGap: 2 })
    if (settings.bank_details) {
      doc.fillColor("#111827").font("Helvetica-Bold").text("Bank Details", margin, footerY + 60)
      doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(settings.bank_details, margin, footerY + 75, { width: 250, lineGap: 2 })
    }

    // 8. PAGE NUMBERING
    const range = doc.bufferedPageRange(); 
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#9ca3af").fontSize(8).text(`${i + 1} / ${range.count}`, margin, 800, { align: "center", width: 500 });
    }
  },
  minimal: async (doc: any, order: any, settings: any, type: string = "invoice") => {
    // 1. DATA SAFETY CHECKS
    const items = order?.items ||[]
    const billingAddress = order?.billing_address
    const margin = 50
    const tableWidth = 500
    const pageBottomThreshold = 700 
    
    // Minimal uses black/white/gray mostly, brand color sparingly
    const brandColor = settings.primary_color || "#000000" 

    let totalRefunded = 0;
    if (order?.payment_collections) {
      order.payment_collections.forEach((pc: any) => {
        if (pc.payments) {
          pc.payments.forEach((p: any) => {
            if (p.refunds) {
              p.refunds.forEach((r: any) => {
                totalRefunded += (r.amount || 0);
              });
            }
          });
        }
      });
    }
    if (order?.refunds) {
      order.refunds.forEach((r: any) => {
        totalRefunded += (r.amount || 0);
      });
    }
    if (order?.summary?.refunded_total) {
      totalRefunded = Math.max(totalRefunded, order.summary.refunded_total);
    }

    // 2. ROBUST PAID CHECK
    const hasCapturedCollection = order?.payment_collections?.some(
      (pc: any) => pc.status === "captured" || pc.payments?.some((p: any) => p.captured_at)
    );
    
    const isPaid = !!(
      type === "receipt" || 
      order?.payment_status === "captured" || 
      order?.payment_status === "paid" || 
      order?.status === "completed" || 
      hasCapturedCollection
    );

    let documentTitle = "Invoice"
    let watermarkText = ""
    let showWatermark = false

    if (type === "receipt") documentTitle = "Receipt"
    if (type === "credit_note") documentTitle = "Credit Note"

    const isFullyRefunded = order?.payment_status === "refunded" || (totalRefunded > 0 && totalRefunded >= (order?.total || 0));
    const isPartiallyRefunded = order?.payment_status === "partially_refunded" || (totalRefunded > 0 && totalRefunded < (order?.total || 0));

    if (order?.status === "canceled" || order?.payment_status === "canceled") {
      watermarkText = "CANCELLED"
      showWatermark = true
    } else if (isFullyRefunded || type === "credit_note") {
      watermarkText = "REFUNDED"
      showWatermark = true
    } else if (isPartiallyRefunded) {
      watermarkText = "PARTIAL REFUND"
      showWatermark = true
    } else if (isPaid) {
      watermarkText = "PAID"
      showWatermark = true
    }

    if (showWatermark) drawWatermark(doc, watermarkText)

    // 3. HEADER & BRANDING (Minimal: Lots of whitespace, elegant typography)
    
    // Logo Placeholder or Image (Centered in minimal)
    if (settings.logo_url) {
      try {
        const response = await fetch(settings.logo_url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          doc.image(buffer, margin, 40, { fit: [60, 60], align: 'left', valign: 'top' });
        } else {
          throw new Error('Failed to fetch logo');
        }
      } catch (err) {
        doc.rect(margin, 40, 60, 60).stroke("#e5e7eb")
        doc.fillColor("#9ca3af").font("Helvetica").fontSize(10).text("LOGO", margin + 14, 65)
      }
    } else {
      doc.rect(margin, 40, 60, 60).stroke("#e5e7eb")
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(10).text("LOGO", margin + 14, 65)
    }

    const prefix = settings.invoice_prefix || "INV-"
    const dateStr = new Date(order?.created_at || Date.now()).toISOString().slice(0, 7).replace('-', '') // YYYYMM
    const orderIdStr = order?.display_id ? String(order.display_id).replace(/^order_/, '') : (order?.id ? String(order.id).replace(/^order_/, '') : "N/A")
    const invoiceNumber = `${prefix}${dateStr}-${orderIdStr}`

    doc.fillColor("#000000").fontSize(20).font("Helvetica").text(documentTitle, 400, 40, { align: 'right', characterSpacing: 2 })
    doc.fillColor("#6b7280").fontSize(9).font("Helvetica").text(invoiceNumber, 400, 65, { align: 'right' })
    doc.text(new Date(order?.created_at || Date.now()).toLocaleDateString(), 400, 80, { align: 'right' })

    // 4. INFO GRID
    const gridY = 140
    
    doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(settings.store_name || "Store Name", margin, gridY)
    doc.fillColor("#6b7280").fontSize(9).font("Helvetica").text(settings.address || "", margin, gridY + 15, { width: 200, lineGap: 2 })

    if (billingAddress) {
      const name = `${billingAddress.first_name || ""} ${billingAddress.last_name || ""}`.trim()
      doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text(name || order?.customer?.first_name || "Customer", 350, gridY)
      
      const lines =[
        billingAddress.company,
        billingAddress.address_1,
        billingAddress.address_2,
        `${billingAddress.city || ""} ${billingAddress.postal_code || ""}`.trim(),
        billingAddress.country_code?.toUpperCase()
      ].filter(Boolean)

      doc.fillColor("#6b7280").font("Helvetica").fontSize(9)
      lines.forEach((line, index) => {
        doc.text(line, 350, gridY + 15 + (index * 12)) 
      })
    } else {
      doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(order?.email || "No address", 350, gridY + 15)
    }

    // 5. THE TABLE (Minimal: Very light borders, spacious)
    let currentY = 260
    const colDesc = 300, colQty = 50, colPrice = 70, colAmount = 80
    
    // Header
    doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(0.5).strokeColor("#000000").stroke()
    currentY += 10
    doc.fillColor("#000000").font("Helvetica").fontSize(8)
    doc.text("DESCRIPTION", margin, currentY, { characterSpacing: 1 })
    doc.text("QTY", margin + colDesc, currentY, { align: 'center', width: colQty, characterSpacing: 1 })
    doc.text("PRICE", margin + colDesc + colQty, currentY, { align: 'right', width: colPrice, characterSpacing: 1 })
    doc.text("TOTAL", margin + colDesc + colQty + colPrice, currentY, { align: 'right', width: colAmount, characterSpacing: 1 })
    currentY += 15
    doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(0.5).strokeColor("#000000").stroke()
    currentY += 20
    
    const rowHeight = 35
    doc.font("Helvetica").fontSize(9)

    if (items.length === 0) {
      doc.fillColor("#6b7280").text("No items.", margin, currentY)
    }

    items.forEach((item: any, index: number) => {
      const textHeight = doc.heightOfString(item.title || "Item", { width: colDesc - 20 })
      const dynamicRowHeight = Math.max(rowHeight, textHeight + 20)

      if (currentY + dynamicRowHeight > pageBottomThreshold) {
        doc.addPage()
        if (isPaid) drawWatermark(doc)
        currentY = 50 
        
        // Redraw Header
        doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(0.5).strokeColor("#000000").stroke()
        currentY += 10
        doc.fillColor("#000000").font("Helvetica").fontSize(8)
        doc.text("DESCRIPTION", margin, currentY, { characterSpacing: 1 })
        doc.text("QTY", margin + colDesc, currentY, { align: 'center', width: colQty, characterSpacing: 1 })
        doc.text("PRICE", margin + colDesc + colQty, currentY, { align: 'right', width: colPrice, characterSpacing: 1 })
        doc.text("TOTAL", margin + colDesc + colQty + colPrice, currentY, { align: 'right', width: colAmount, characterSpacing: 1 })
        currentY += 15
        doc.moveTo(margin, currentY).lineTo(margin + tableWidth, currentY).lineWidth(0.5).strokeColor("#000000").stroke()
        currentY += 20
        doc.font("Helvetica").fontSize(9)
      }

      doc.fillColor("#000000")
      const unitPrice = item.unit_price || 0
      const totalAmount = item.total || (unitPrice * (item.quantity || 0))

      doc.text(item.title || "Item", margin, currentY, { width: colDesc - 20 })
      doc.fillColor("#6b7280")
      doc.text(item.quantity?.toString() || "0", margin + colDesc, currentY, { align: 'center', width: colQty })
      doc.text(formatCurrency(unitPrice, order?.currency_code), margin + colDesc + colQty, currentY, { align: 'right', width: colPrice })
      doc.fillColor("#000000")
      doc.text(formatCurrency(totalAmount, order?.currency_code), margin + colDesc + colQty + colPrice, currentY, { align: 'right', width: colAmount })
      
      currentY += dynamicRowHeight
      doc.moveTo(margin, currentY - 10).lineTo(margin + tableWidth, currentY - 10).lineWidth(0.5).strokeColor("#e5e7eb").stroke()
    })

    // 6. TOTALS SECTION
    if (currentY > 600) { doc.addPage(); if (showWatermark) drawWatermark(doc, watermarkText); currentY = 50; }
    currentY += 20
    const totalsX = 350
    doc.fillColor("#6b7280").font("Helvetica").text("Subtotal", totalsX, currentY, { width: 100, align: 'right' })
    doc.fillColor("#000000").text(formatCurrency(order?.summary?.item_total ?? order?.item_total ?? order?.summary?.total ?? order?.total, order?.currency_code), 460, currentY, { width: 90, align: 'right' })
    currentY += 20
    
    const taxTotal = order?.summary?.tax_total ?? order?.tax_total ?? 0;
    if (taxTotal > 0) {
      doc.fillColor("#6b7280").text("Tax", totalsX, currentY, { width: 100, align: 'right' })
      doc.fillColor("#000000").text(formatCurrency(taxTotal, order?.currency_code), 460, currentY, { width: 90, align: 'right' })
      currentY += 20
    }

    // Add refunded amount if applicable
    if (totalRefunded > 0) {
      doc.fillColor("#ea580c").font("Helvetica-Bold").text("Refunded Amount", totalsX, currentY, { width: 100, align: 'right' })
      doc.text(`-${formatCurrency(totalRefunded, order?.currency_code)}`, 460, currentY, { width: 90, align: 'right' })
      currentY += 20
    }
    
    currentY += 10
    doc.moveTo(totalsX + 50, currentY - 5).lineTo(550, currentY - 5).lineWidth(1).strokeColor("#000000").stroke()
    currentY += 10
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(12)
    doc.text("Total", totalsX, currentY, { width: 100, align: 'right' })
    doc.text(formatCurrency(order?.summary?.total ?? order?.total, order?.currency_code), 460, currentY, { width: 90, align: 'right' })

    // 7. FOOTER & DIGITAL STAMP
    let footerY = currentY + 80
    if (footerY > 700) { doc.addPage(); if (showWatermark) drawWatermark(doc, watermarkText); footerY = 50; }

    if (showWatermark) {
      // Minimal stamp
      let stampColor = "#000000"
      let stampTitle = "PAID ELECTRONICALLY"
      let stampStatus = new Date().toUTCString()
      
      if (order?.status === "canceled" || order?.payment_status === "canceled") {
        stampColor = "#dc2626"
        stampTitle = "CANCELLED"
        stampStatus = `Cancelled on ${new Date(order.canceled_at || Date.now()).toLocaleDateString()}`
      } else if (type === "credit_note") {
        stampColor = "#2563eb"
        stampTitle = "CREDIT NOTE ISSUED"
        stampStatus = `Issued on ${new Date().toLocaleDateString()}`
      } else if (isFullyRefunded || isPartiallyRefunded) {
        stampColor = "#ea580c"
        stampTitle = "REFUND ISSUED"
        stampStatus = `Refunded on ${new Date().toLocaleDateString()}`
      }

      doc.fontSize(7).font("Helvetica")
      const transactionText = order?.id?.split('_').pop()?.toUpperCase() || "N/A"
      const transactionHeight = doc.heightOfString(transactionText, { width: 150 })

      doc.moveTo(400, footerY).lineTo(550, footerY).lineWidth(0.5).strokeColor(stampColor).stroke()
      doc.fillColor(stampColor).font("Helvetica").fontSize(7).text(stampTitle, 400, footerY + 10, { characterSpacing: 1 })
      doc.fillColor("#6b7280").text(transactionText, 400, footerY + 22, { width: 150 })
      doc.text(stampStatus, 400, footerY + 22 + transactionHeight)
    }

    doc.fillColor("#000000").font("Helvetica").fontSize(8).text("Terms", margin, footerY, { characterSpacing: 1 })
    doc.fillColor("#6b7280").fontSize(8).text(settings.terms || "Thank you.", margin, footerY + 15, { width: 250, lineGap: 2 })
    if (settings.bank_details) {
      doc.fillColor("#000000").font("Helvetica").text("Payment Details", margin, footerY + 50, { characterSpacing: 1 })
      doc.fillColor("#6b7280").fontSize(8).text(settings.bank_details, margin, footerY + 65, { width: 250, lineGap: 2 })
    }

    // 8. PAGE NUMBERING
    const range = doc.bufferedPageRange(); 
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#d1d5db").fontSize(8).text(`${i + 1}`, margin, 800, { align: "center", width: 500 });
    }
  }
}
