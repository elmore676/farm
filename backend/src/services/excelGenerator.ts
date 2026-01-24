import fs from 'fs';
import path from 'path';

class ExcelGenerator {
  // Placeholder CSV/JSON writers; swap with ExcelJS when dependency is added.
  async generate(id: string, type: string, data: any, outDir: string) {
    const filename = `${type}-${id}.xlsx`;
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { path: filePath, filename };
  }

  async generateCsv(id: string, type: string, data: any, outDir: string) {
    const filename = `${type}-${id}.csv`;
    const filePath = path.join(outDir, filename);
    const rows = Array.isArray(data.rows) ? data.rows : [data];
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const header = keys.join(',');
    const lines = rows.map((r: any) => keys.map((k) => JSON.stringify((r as any)[k] ?? '')).join(','));
    fs.writeFileSync(filePath, [header, ...lines].join('\n'), 'utf8');
    return { path: filePath, filename };
  }
}

export const excelGenerator = new ExcelGenerator();
export default excelGenerator;
