import { recordId } from './registry.js';

/**
 * score = severity_weight * hotspot(anchor files, max) * confidence
 *         / effort_weight * (recurring_bonus if seen_count >= 3)
 *
 * hotspot is each anchor file's commit count normalized against the busiest
 * file in scope (0 to 1); a multi-file finding takes the max across its
 * anchors. seen_count comes from the existing registry record matched by id
 * (0 for a finding that has never been seen before).
 */
export function score(findings, scopeFiles, registry, weights) {
  const hotspotByFile = hotspotMap(scopeFiles);
  const seenCountById = indexSeenCounts(registry);

  return findings.map((finding) => {
    const id = recordId(finding.category, finding.anchors);
    const seenCount = seenCountById[id] ?? 0;
    const hotspot = findingHotspot(finding, hotspotByFile);
    const severityWeight = weights.severity[finding.severity];
    const effortWeight = weights.effort[finding.effort];
    const recurringBonus = seenCount >= 3 ? weights.recurring_bonus : 1;
    const value = (severityWeight * hotspot * finding.confidence / effortWeight) * recurringBonus;

    return {
      ...finding,
      score: value,
      score_detail: {
        severity_weight: severityWeight,
        hotspot,
        effort_weight: effortWeight,
        recurring_bonus: recurringBonus,
      },
    };
  });
}

function hotspotMap(scopeFiles) {
  const maxCommits = Math.max(1, ...scopeFiles.map((file) => file.commits));
  const map = {};

  for (const file of scopeFiles) {
    map[file.path] = file.commits / maxCommits;
  }

  return map;
}

function indexSeenCounts(registry) {
  const map = {};

  for (const record of registry) {
    map[record.id] = record.seen_count;
  }

  return map;
}

function findingHotspot(finding, hotspotByFile) {
  const values = finding.anchors.map((anchor) => hotspotByFile[anchor.file] ?? 0);
  return Math.max(...values);
}
