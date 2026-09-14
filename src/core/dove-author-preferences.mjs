import { DOVE_AUTHOR_PREFERENCES_CONTENT } from "./dove-author-preferences-content.generated.mjs";

export const DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES.md"
});

export const DOVE_AUTHOR_PREFERENCES_READ_TRIGGER = `Read relevant sections of the full author preferences at \`${DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude}\` when research, engineering, writing, or collaboration decisions need them. Reuse guidance already read in the active context; apply it within the current request and project constraints, not as a full-task checklist or research evidence.`;

export function renderDoveAuthorPreferencesReference() {
  return DOVE_AUTHOR_PREFERENCES_CONTENT;
}
