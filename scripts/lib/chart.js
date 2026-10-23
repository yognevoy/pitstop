import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Chart, registerables } from 'chart.js';
import { createCanvas } from '@napi-rs/canvas';

Chart.register(...registerables);

/**
 * Renders values as a PNG line chart to outputPath.
 */
export function renderChart(values, outputPath, { label = 'value', createCanvasFn = createCanvas } = {}) {
  try {
    const canvas = createCanvasFn(400, 220);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: values.map((_, i) => i),
        datasets: [
          {
            label,
            data: values,
            borderColor: '#2563eb',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: { display: true },
        },
        scales: {
          x: { display: true, title: { display: true, text: 'run' } },
          y: { display: true, title: { display: true, text: label } },
        },
      },
    });

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, canvas.toBuffer('image/png'));
    chart.destroy();
    return true;
  } catch {
    return false;
  }
}
