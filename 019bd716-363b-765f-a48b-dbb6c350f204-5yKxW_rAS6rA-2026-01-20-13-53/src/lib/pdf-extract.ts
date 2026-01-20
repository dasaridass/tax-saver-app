/**
 * PDF text extraction using pdf.js
 * Note: PDF.js requires browser APIs and only works on web
 * Mobile users should use the web version for PDF analysis
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// pdf.js version and CDN URLs - web only
const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// Type definitions for pdf.js
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  getMetadata(): Promise<{ info: Record<string, unknown> }>;
}

interface PDFPageProxy {
  getTextContent(): Promise<TextContent>;
}

interface TextContent {
  items: TextItem[];
}

interface TextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

interface PDFJSLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(params: { data: ArrayBuffer }): { promise: Promise<PDFDocumentProxy> };
}

let pdfjsLib: PDFJSLib | null = null;

/**
 * Check if PDF extraction is supported on this platform
 * Only web browsers support PDF.js
 */
export function isPDFExtractionSupported(): boolean {
  return Platform.OS === 'web';
}

/**
 * Dynamically loads pdf.js library (web only)
 */
async function loadPdfJs(): Promise<PDFJSLib> {
  if (Platform.OS !== 'web') {
    throw new Error('PDF analysis is only available in a web browser. Please visit our web app to analyze your documents.');
  }

  if (pdfjsLib) return pdfjsLib;

  // Check if already loaded globally
  if (typeof window !== 'undefined' && (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib) {
    pdfjsLib = (window as unknown as { pdfjsLib: PDFJSLib }).pdfjsLib;
    return pdfjsLib;
  }

  try {
    // Load pdf.js via script tag for better compatibility
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_CDN;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PDF.js script'));
      document.head.appendChild(script);
    });

    // Get the globally loaded pdfjsLib
    const pdfjs = (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib;

    if (pdfjs && pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      pdfjsLib = pdfjs;
      return pdfjs;
    } else {
      throw new Error('PDF library loaded but missing required properties');
    }
  } catch (error) {
    console.error('PDF.js loading error:', error);
    throw new Error('Failed to load PDF processing library. Please refresh the page and try again.');
  }
}

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
  };
}

/**
 * Extracts text from a PDF file with better structure preservation
 * @param file - The PDF file to extract text from
 * @returns Extracted text and metadata
 */
export async function extractTextFromPDF(
  file: File
): Promise<PDFExtractionResult> {
  const pdfjs = await loadPdfJs();

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load the PDF document
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  // Extract text from all pages
  const textParts: string[] = [];
  const pageCount = pdf.numPages;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by approximate Y position (same line)
    // and preserve spacing between items on the same line
    const lines: Map<number, { x: number; text: string }[]> = new Map();

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str || item.str.trim() === '') continue;

      // Get Y position (rounded to group items on same line)
      // Transform array: [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const y = item.transform ? Math.round(item.transform[5]) : 0;
      const x = item.transform ? item.transform[4] : 0;

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push({ x, text: item.str });
    }

    // Sort lines by Y position (descending - top to bottom in PDF coordinates)
    const sortedLines = Array.from(lines.entries())
      .sort((a, b) => b[0] - a[0]);

    // Build page text with proper line breaks and spacing
    const pageLines: string[] = [];

    for (const [, items] of sortedLines) {
      // Sort items on each line by X position (left to right)
      items.sort((a, b) => a.x - b.x);

      // Join items with appropriate spacing
      let lineText = '';
      let lastX = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (i > 0) {
          // Calculate gap between this item and the previous one
          const gap = item.x - lastX;

          // Add tab for large gaps (likely table columns), space for small gaps
          if (gap > 50) {
            lineText += '\t';
          } else if (gap > 5) {
            lineText += ' ';
          }
        }

        lineText += item.text;
        lastX = item.x + (item.text.length * 5); // Approximate width
      }

      if (lineText.trim()) {
        pageLines.push(lineText);
      }
    }

    textParts.push(`--- Page ${pageNum} ---\n${pageLines.join('\n')}`);
  }

  // Get metadata
  const metadata = await pdf.getMetadata().catch(() => null);
  const info = metadata?.info as Record<string, string> | undefined;

  return {
    text: textParts.join('\n\n'),
    pageCount,
    metadata: info
      ? {
          title: info.Title,
          author: info.Author,
          subject: info.Subject,
        }
      : undefined,
  };
}

/**
 * Validates that a file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Validates that a document picker result is a PDF
 */
export function isPDFDocument(mimeType?: string, name?: string): boolean {
  return (
    mimeType === 'application/pdf' ||
    (name?.toLowerCase().endsWith('.pdf') ?? false)
  );
}

/**
 * Extracts text from a PDF file URI (for mobile platforms)
 * Note: This only works on web due to pdf.js browser requirements
 * @param uri - The file URI from document picker
 * @param fileName - The original file name
 * @returns Extracted text and metadata
 */
export async function extractTextFromPDFUri(
  uri: string,
  fileName: string
): Promise<PDFExtractionResult> {
  const pdfjs = await loadPdfJs();

  let arrayBuffer: ArrayBuffer;

  if (Platform.OS === 'web') {
    // On web, fetch the file
    const response = await fetch(uri);
    arrayBuffer = await response.arrayBuffer();
  } else {
    // On mobile, read the file using FileSystem
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  }

  // Load the PDF document
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  // Extract text from all pages
  const textParts: string[] = [];
  const pageCount = pdf.numPages;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by approximate Y position (same line)
    const lines: Map<number, { x: number; text: string }[]> = new Map();

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str || item.str.trim() === '') continue;

      const y = item.transform ? Math.round(item.transform[5]) : 0;
      const x = item.transform ? item.transform[4] : 0;

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push({ x, text: item.str });
    }

    // Sort lines by Y position (descending - top to bottom in PDF coordinates)
    const sortedLines = Array.from(lines.entries())
      .sort((a, b) => b[0] - a[0]);

    // Build page text with proper line breaks and spacing
    const pageLines: string[] = [];

    for (const [, items] of sortedLines) {
      items.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lastX = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (i > 0) {
          const gap = item.x - lastX;
          if (gap > 50) {
            lineText += '\t';
          } else if (gap > 5) {
            lineText += ' ';
          }
        }

        lineText += item.text;
        lastX = item.x + (item.text.length * 5);
      }

      if (lineText.trim()) {
        pageLines.push(lineText);
      }
    }

    textParts.push(`--- Page ${pageNum} ---\n${pageLines.join('\n')}`);
  }

  // Get metadata
  const metadata = await pdf.getMetadata().catch(() => null);
  const info = metadata?.info as Record<string, string> | undefined;

  return {
    text: textParts.join('\n\n'),
    pageCount,
    metadata: info
      ? {
          title: info.Title,
          author: info.Author,
          subject: info.Subject,
        }
      : undefined,
  };
}
