import { DOVE_TOPIC_CRITERIA_CONTENT } from "./dove-topic-criteria-content.generated.mjs";

// Dove owns the topic-selection standard: docs/TOPIC_CRITERIA.md is the single
// source, revised in Dove at the user's request, and every installation
// carries the current copy like the quality and preference references.
export const DOVE_TOPIC_CRITERIA_REFERENCE_PATH = ".dove/install/TOPIC_CRITERIA.md";

export function renderDoveTopicCriteriaReference() {
  return DOVE_TOPIC_CRITERIA_CONTENT;
}
