/**
 * Adaptador de infraestructura: CsvJsonExporter
 * Exporta resultados del laboratorio a archivos JSON y CSV.
 */
const fs = require('fs');
const path = require('path');

class CsvJsonExporter {
  constructor({ outputDir = '.' } = {}) {
    this.outputDir = outputDir;
  }

  export(results, baseName = 'lab-results') {
    const jsonPath = path.join(this.outputDir, `${baseName}.json`);
    const csvPath = path.join(this.outputDir, `${baseName}.csv`);

    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    if (results.length > 0) {
      const headers = Object.keys(results[0]);
      const lines = [headers.join(',')];
      for (const row of results) {
        const values = headers.map((h) => {
          const v = String(row[h] ?? '').replace(/"/g, '""');
          return `"${v}"`;
        });
        lines.push(values.join(','));
      }
      fs.writeFileSync(csvPath, lines.join('\n'));
    }

    return { jsonPath, csvPath, count: results.length };
  }
}

module.exports = { CsvJsonExporter };
