const BLOCKS = '▁▂▃▄▅▆▇█';

/** Renders a series of numbers as a one-line block sparkline. */
export function sparkline(values) {
  if (values.length === 0) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return values
    .map((value) => {
      if (range === 0) {
        return BLOCKS[Math.floor((BLOCKS.length - 1) / 2)];
      }

      const index = Math.round(((value - min) / range) * (BLOCKS.length - 1));
      return BLOCKS[index];
    })
    .join('');
}
