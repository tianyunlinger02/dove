import { DOVE_AUTHOR_PREFERENCES_CONTENT } from "./dove-author-preferences-content.generated.mjs";

export const DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES.md"
});

export const DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP = `At the beginning of each fresh main-agent context—including Claude startup or /clear, and the first author-side Dove Skill use on a host without a session hook—the current host main agent must personally read the full author preferences at \`${DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude}\` completely from beginning to end before substantive research, engineering, writing, or collaboration work. If a read is truncated, continue with offsets until EOF. Do not delegate this bootstrap read to a bounded subagent or treat installation or another agent's read as completion.`;

export const DOVE_AUTHOR_PREFERENCES_CONTINUITY = `This is a continuation of the same main context: keep using the author preferences already read here rather than rereading the full file merely because of compact or resume. If the recovered context clearly lacks that completed bootstrap, the current main agent must complete the full read before further substantive work.`;

export const DOVE_AUTHOR_PREFERENCES_READ_TRIGGER = `${DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP} Reuse that guidance for the rest of the active main context and reread relevant sections only when details are uncertain or context was lost. Apply it within the current request and project constraints, not as a full-task checklist, research evidence, or additional permission.`;

export function renderDoveAuthorPreferencesReference() {
  return DOVE_AUTHOR_PREFERENCES_CONTENT;
}
