import fs from 'fs';
import path from 'path';

class PDFGenerator {
  // Placeholder implementation; replace with Puppeteer-based renderer.
  async generate(id: string, type: string, html: string, outDir: string) {
    const filename = `${type}-${id}.pdf`;
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, html, 'utf8');
    return { path: filePath, filename };
  }
}

export const pdfGenerator = new PDFGenerator();
export default pdfGenerator;
