import { PDFDocument } from 'pdf-lib'

/**
 * Combine an array of PNG image buffers into a single PDF.
 * Each image becomes one page at 1080×1080 points.
 */
export async function pngsToPdf(pngs: Buffer[]): Promise<Buffer> {
  if (pngs.length === 0) throw new Error('Cannot create PDF with zero pages')
  const doc = await PDFDocument.create()

  for (const png of pngs) {
    const image = await doc.embedPng(png)
    const page = doc.addPage([1080, 1080])
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
    })
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
