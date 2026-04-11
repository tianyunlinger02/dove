export const toolDefinitions = [
  {
    name: "ensure_workspace",
    description: "Ensure the canonical .paper workspace and starter artifacts exist.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "init_project",
    description: "Initialize or refresh project metadata and the research contract.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        venue: { type: "string" },
        objective: { type: "string" },
        deadline: { type: "string" },
        thesis: { type: "string" },
        audience: { type: "string" },
        strictMode: { type: "boolean" }
      }
    }
  },
  {
    name: "read_state",
    description: "Read the normalized paper_factory state.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "upsert_orchestration_board",
    description: "Update the canonical orchestration board under .paper/orchestration/board.json.",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string" },
        phase: { type: "string" },
        assignedRole: { type: "string" },
        tasks: { type: "array", items: { type: "object" } },
        blockers: { type: "array", items: { type: "object" } },
        evidenceLinks: { type: "array", items: { type: "string" } },
        experimentIds: { type: "array", items: { type: "string" } },
        rebuttalIssueIds: { type: "array", items: { type: "string" } },
        activeComparisonTargets: { type: "array", items: { type: "string" } },
        versionLineage: { type: "object" }
      }
    }
  },
  {
    name: "append_handoff",
    description: "Append a durable handoff entry and update the assigned role.",
    inputSchema: {
      type: "object",
      properties: {
        fromRole: { type: "string" },
        toRole: { type: "string" },
        phase: { type: "string" },
        summary: { type: "string" },
        nextActions: { type: "array", items: { type: "string" } },
        evidenceLinks: { type: "array", items: { type: "string" } },
        blockerIds: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "update_research_brief",
    description: "Update the durable research brief and agenda artifacts.",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string" },
        agenda: { type: "array", items: { type: "string" } },
        evidenceBacklog: { type: "array", items: { type: "string" } },
        phase: { type: "string" },
        assignedRole: { type: "string" }
      }
    }
  },
  {
    name: "register_source",
    description: "Register or update a provenance-aware source record.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string" },
        citationKey: { type: "string" },
        title: { type: "string" },
        authors: { type: "array", items: { type: "string" } },
        year: { type: ["string", "number"] },
        locator: { type: "string" },
        sourceType: { type: "string" },
        abstract: { type: "string" },
        origin: { type: "string" }
      }
    }
  },
  {
    name: "upsert_note",
    description: "Create or update a structured note linked to one or more sources.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: { type: "string" },
        title: { type: "string" },
        sectionId: { type: "string" },
        sourceIds: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        quotes: { type: "array", items: { type: "string" } },
        claims: { type: "array", items: { type: "string" } },
        openQuestions: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "upsert_claims",
    description: "Write claims derived from results into the evidence store.",
    inputSchema: {
      type: "object",
      properties: {
        claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              sectionId: { type: "string" },
               sourceIds: { type: "array", items: { type: "string" } },
               noteIds: { type: "array", items: { type: "string" } },
               experimentIds: { type: "array", items: { type: "string" } },
               evidenceLinks: { type: "array", items: { type: "string" } },
               status: { type: "string" },
               confidence: { type: "string" },
               gap: { type: "string" }
            }
          }
        }
      }
    }
  },
  {
    name: "upsert_plan",
    description: "Create or update the current plan artifact.",
    inputSchema: {
      type: "object",
      properties: {
        thesis: { type: "string" },
        audience: { type: "string" },
        sections: { type: "array", items: { type: "string" } },
        evidenceGaps: { type: "array", items: { type: "string" } },
        milestones: { type: "array", items: { type: "string" } },
        figures: { type: "array", items: { type: "string" } },
        notes: { type: "string" }
      }
    }
  },
  {
    name: "upsert_outline",
    description: "Create or update the current section outline.",
    inputSchema: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              status: { type: "string" },
              goal: { type: "string" },
              evidenceFocus: { type: "string" }
            }
          }
        }
      }
    }
  },
  {
    name: "upsert_draft",
    description: "Create or update a section draft under .paper/drafts.",
    inputSchema: {
      type: "object",
      properties: {
        sectionId: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        status: { type: "string" },
        summary: { type: "string" }
      }
    }
  },
  {
    name: "upsert_experiment_plan",
    description: "Create or update a claim-driven experiment plan.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        claimId: { type: "string" },
        hypothesis: { type: "string" },
        methodology: { type: "string" },
        successMetric: { type: "string" },
        comparisonTargets: { type: "array", items: { type: "string" } },
        status: { type: "string" },
        owner: { type: "string" }
      }
    }
  },
  {
    name: "upsert_experiment_result",
    description: "Create or update a durable experiment result entry.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        experimentId: { type: "string" },
        claimId: { type: "string" },
        outcome: { type: "string" },
        summary: { type: "string" },
        evidenceLinks: { type: "array", items: { type: "string" } },
        comparisonTargets: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "run_review_loop",
    description: "Run an evidence-aware review pass and generate a revision plan.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string" },
        stage: { type: "string" }
      }
    }
  },
  {
    name: "append_review_log",
    description: "Append a structured manual review entry.",
    inputSchema: {
      type: "object",
      properties: {
        timestamp: { type: "string" },
        stage: { type: "string" },
        scope: { type: "string" },
        verdict: { type: "string" },
        summary: { type: "string" },
        findings: { type: "array", items: { type: "object" } },
        actionItems: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "upsert_revision_plan",
    description: "Write a manual revision plan artifact.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        items: { type: "array", items: { type: "string" } },
        updatedAt: { type: "string" }
      }
    }
  },
  {
    name: "set_section_status",
    description: "Update the status and summary for a section.",
    inputSchema: {
      type: "object",
      properties: {
        sectionId: { type: "string" },
        status: { type: "string" },
        summary: { type: "string" }
      }
    }
  },
  {
    name: "sync_checklist",
    description: "Regenerate the checklist from current state and review findings.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "sync_citations",
    description: "Audit citations and regenerate references.bib plus the citation log.",
    inputSchema: {
      type: "object",
      properties: {
        citedOnly: { type: "boolean" }
      }
    }
  },
  {
    name: "refresh_wiki",
    description: "Regenerate the durable research wiki from current sources, notes, claims, and review state.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "normalize_rebuttal_issues",
    description: "Normalize reviewer issues into a durable rebuttal issue board.",
    inputSchema: {
      type: "object",
      properties: {
        issues: { type: "array", items: { type: "object" } }
      }
    }
  },
  {
    name: "build_rebuttal_strategy",
    description: "Generate the rebuttal strategy and response draft from normalized issues.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "build_rebuttal",
    description: "Generate an artifact-backed rebuttal draft from review and evidence state.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "create_version_snapshot",
    description: "Snapshot the current paper state and update version lineage.",
    inputSchema: {
      type: "object",
      properties: {
        versionId: { type: "string" },
        label: { type: "string" },
        parentVersionId: { type: "string" },
        summary: { type: "string" }
      }
    }
  },
  {
    name: "compare_versions",
    description: "Compare two durable paper snapshots and record the comparison.",
    inputSchema: {
      type: "object",
      properties: {
        fromVersionId: { type: "string" },
        toVersionId: { type: "string" }
      }
    }
  },
  {
    name: "list_artifacts",
    description: "List the expected paper_factory artifacts and whether they exist.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "upsert_figure_plan",
    description: "Write the figure backlog artifact.",
    inputSchema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object" } }
      }
    }
  }
];
