export const DOVE_WORKFLOW_KERNEL_VERSION = "dove-mission-kernel-v1";

export const DOVE_MISSION_LIFECYCLE_STAGES = ["goal", "design", "checklist", "execution", "audit", "return"];

export const DOVE_DOMAIN_IDS = ["paper", "engineering", "experiment", "review", "general"];

export const DOVE_DOMAIN_GUIDANCE = [
  {
    id: "paper",
    label: "Paper",
    summary: "Paper writing, research, claims, citations, rebuttal, figures, and versioned manuscript work.",
    stageRoutes: {
      goal: "project:dove.source",
      design: "project:dove.mission",
      checklist: "project:dove.status",
      execution: "project:dove.draft",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["claim/evidence coverage", "checklist status", "review verdict", "version comparison"]
  },
  {
    id: "engineering",
    label: "Engineering",
    summary: "Normal engineering requirements, implementation work, tests, regressions, and code review framed as the same Dove mission lifecycle.",
    stageRoutes: {
      goal: "project:dove.mission",
      design: "project:dove.mission",
      checklist: "project:dove.status",
      execution: "project:dove.mission or project:dove.auto",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["changed files", "tests or validation output", "review notes", "acceptance checklist"]
  },
  {
    id: "experiment",
    label: "Experiment",
    summary: "Experiment plans, runs, result interpretation, audit findings, and result-to-claim traceability.",
    stageRoutes: {
      goal: "project:dove.experience",
      design: "project:dove.experience",
      checklist: "project:dove.status",
      execution: "project:dove.experience",
      audit: "project:dove.experience",
      return: "project:dove.experience"
    },
    returnEvidence: ["experiment audit", "result log", "claim bridge", "review verdict"]
  },
  {
    id: "review",
    label: "Review",
    summary: "Independent critique, reviewer concerns, isolated review handoffs, and acceptance pressure.",
    stageRoutes: {
      goal: "project:dove.mission",
      design: "project:dove.review",
      checklist: "project:dove.status",
      execution: "project:dove.review",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["review report", "concern state", "revision plan", "acceptance verdict"]
  },
  {
    id: "general",
    label: "General",
    summary: "General bounded research or workflow work that still uses one mission, one board, and one return protocol.",
    stageRoutes: {
      goal: "project:dove.mission",
      design: "project:dove.mission",
      checklist: "project:dove.status",
      execution: "project:dove.mission",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["task packet", "handoff", "audit summary", "acceptance checklist"]
  }
];

export const DOVE_PRIMARY_ROLES = [
  {
    id: "planner",
    label: "Planner",
    summary: "Sets destination, scope, constraints, priorities, and acceptance criteria."
  },
  {
    id: "builder",
    label: "Builder",
    summary: "Performs writing, coding, experiments, data work, implementation, and revision."
  },
  {
    id: "reviewer",
    label: "Reviewer",
    summary: "Independently audits returned work, concerns, evidence, tests, and acceptance."
  }
];

export const DOVE_PRIMARY_ROLE_IDS = DOVE_PRIMARY_ROLES.map((role) => role.id);
