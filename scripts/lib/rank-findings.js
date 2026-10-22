/**
 * Sorts findings by score descending, then the first anchor's file.
 * Truncates to topK.
 */
export function rankFindings(findings, topK) {
  const sorted = [...findings].sort(compareFindings);
  return sorted.slice(0, topK);
}

function compareFindings(a, b) {
  const scoreDiff = b.score - a.score;

  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const pathA = a.anchors[0].file;
  const pathB = b.anchors[0].file;

  if (pathA < pathB) {
    return -1;
  }

  if (pathA > pathB) {
    return 1;
  }

  return 0;
}
