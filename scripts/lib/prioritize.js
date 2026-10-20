const SEVERITY_RANK = { must: 3, should: 2, nice: 1 };

/**
 * Sorts findings by severity, then confidence descending,
 * then the first anchor's file. Truncates to topK.
 */
export function prioritize(findings, topK) {
  const sorted = [...findings].sort(compareFindings);
  return sorted.slice(0, topK);
}

function compareFindings(a, b) {
  const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];

  if (severityDiff !== 0) {
    return severityDiff;
  }

  const confidenceDiff = b.confidence - a.confidence;

  if (confidenceDiff !== 0) {
    return confidenceDiff;
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
