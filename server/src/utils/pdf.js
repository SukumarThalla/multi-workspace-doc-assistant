import { PDFParse } from 'pdf-parse';

// Extracts raw text from an uploaded file (multer's in-memory file object).
export async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
  return file.buffer.toString('utf-8');
}
