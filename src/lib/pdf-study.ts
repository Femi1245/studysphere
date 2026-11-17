import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_PAGES = 80
const MAX_TEXT_CHARACTERS = 120_000
const MAX_PREVIEWS = 4
const MAX_PREVIEW_WIDTH = 900

export interface PdfPagePreview {
  page: number
  imageUrl: string
}

export interface ParsedStudyPdf {
  fileName: string
  pageCount: number
  text: string
  previews: PdfPagePreview[]
}

export async function readStudyPdf(file: File): Promise<ParsedStudyPdf> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Choose a PDF file.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('This PDF is larger than 20 MB. Choose a smaller file.')
  }
  if (file.size === 0) {
    throw new Error('This PDF is empty.')
  }

  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = getDocument({ data: await file.arrayBuffer() })
  const document = await loadingTask.promise
  try {
    if (document.numPages > MAX_PAGES) {
      throw new Error(`This PDF has ${document.numPages} pages. The current limit is ${MAX_PAGES} pages.`)
    }

    const textPages: string[] = []
    const previews: PdfPagePreview[] = []
    let characterCount = 0

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ')
        .trim()

      if (pageText) {
        characterCount += pageText.length
        if (characterCount > MAX_TEXT_CHARACTERS) {
          throw new Error(
            `This PDF contains more than ${MAX_TEXT_CHARACTERS.toLocaleString()} characters of text. Split it into smaller files to study it.`,
          )
        }
        textPages.push(`[Page ${pageNumber}]\n${pageText}`)
      }

      if (pageNumber <= MAX_PREVIEWS) {
        const baseViewport = page.getViewport({ scale: 1 })
        const scale = Math.min(1.25, MAX_PREVIEW_WIDTH / baseViewport.width)
        const viewport = page.getViewport({ scale })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Could not render a preview of this PDF page.')
        await page.render({ canvas, canvasContext: context, viewport }).promise
        previews.push({ page: pageNumber, imageUrl: canvas.toDataURL('image/jpeg', 0.78) })
        canvas.width = 0
        canvas.height = 0
      }
    }

    return {
      fileName: file.name,
      pageCount: document.numPages,
      text: textPages.join('\n\n'),
      previews,
    }
  } finally {
    await loadingTask.destroy()
  }
}
