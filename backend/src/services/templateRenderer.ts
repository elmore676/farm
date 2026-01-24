type TemplateKey =
  | 'cycle-performance'
  | 'investor-roi'
  | 'financial-summary'
  | 'feed-usage'
  | 'water-quality'
  | 'operations-dashboard'
  | 'custom';

class TemplateRenderer {
  render(template: TemplateKey, data: any): string {
    // Minimal HTML templates; replace with real branded templates.
    const title = data.title ?? template;
    const body = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`;
  }
}

export const templateRenderer = new TemplateRenderer();
export default templateRenderer;
