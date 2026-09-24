'use strict';

function normalizeArtifact(artifact, defaultSource) {
  return {
    id: artifact.id ?? `${defaultSource}:${artifact.title}`,
    source: artifact.source ?? defaultSource,
    title: artifact.title,
    organization: artifact.organization ?? null,
    summary: artifact.summary ?? '',
    skills: Array.from(new Set((artifact.skills ?? []).map((skill) => skill.trim()).filter(Boolean))),
    evidence: artifact.evidence ?? null,
  };
}

function buildWorkPortfolio({ githubArtifacts = [], portfolioArtifacts = [] } = {}) {
  const artifacts = [
    ...githubArtifacts.map((artifact) => normalizeArtifact(artifact, 'github')),
    ...portfolioArtifacts.map((artifact) => normalizeArtifact(artifact, 'portfolio')),
  ];

  const skillIndex = new Map();

  for (const artifact of artifacts) {
    for (const skill of artifact.skills) {
      const key = skill.toLowerCase();
      const existing = skillIndex.get(key) ?? { skill, count: 0, sources: new Set() };
      existing.count += 1;
      existing.sources.add(artifact.source);
      skillIndex.set(key, existing);
    }
  }

  const strengths = Array.from(skillIndex.values())
    .sort((left, right) => right.count - left.count || left.skill.localeCompare(right.skill))
    .map((entry) => ({
      skill: entry.skill,
      count: entry.count,
      sources: Array.from(entry.sources).sort(),
    }));

  return {
    artifacts,
    strengths,
  };
}

function scoreArtifactAgainstPosition(artifact, positionSkills) {
  const normalizedPositionSkills = positionSkills.map((skill) => skill.toLowerCase());

  return artifact.skills.reduce((score, skill) => {
    return score + (normalizedPositionSkills.includes(skill.toLowerCase()) ? 1 : 0);
  }, 0);
}

function tailorApplication({ portfolio, position, voiceProfile, variant = 'A' }) {
  const positionSkills = position.skills ?? [];
  const rankedArtifacts = [...portfolio.artifacts]
    .map((artifact) => ({
      artifact,
      score: scoreArtifactAgainstPosition(artifact, positionSkills),
    }))
    .sort((left, right) => right.score - left.score || left.artifact.title.localeCompare(right.artifact.title))
    .filter((entry) => entry.score > 0);

  const selectedArtifacts = rankedArtifacts.slice(0, 3).map((entry) => entry.artifact);
  const preferredPhrase = voiceProfile.preferredPhrase ?? 'I focus on practical results';

  const resumeBullets = selectedArtifacts.map((artifact) => {
    const matchedSkills = artifact.skills.filter((skill) =>
      positionSkills.map((value) => value.toLowerCase()).includes(skill.toLowerCase())
    );

    return `${preferredPhrase}: ${artifact.title} applied ${matchedSkills.join(', ')} through ${artifact.source} experience.`;
  });

  const coverLetter = [
    `Hi ${position.hiringTeam ?? 'hiring team'},`,
    `I'm excited about the ${position.title} role because it matches work I've already shipped across ${selectedArtifacts
      .map((artifact) => artifact.source)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(' and ')} experience.`,
    ...selectedArtifacts.map(
      (artifact) =>
        `${preferredPhrase}, I can point to ${artifact.title}${artifact.organization ? ` at ${artifact.organization}` : ''}: ${artifact.summary}`
    ),
    `I'd like to bring the same approach to ${position.company}.`,
  ].join('\n\n');

  return {
    variant,
    position,
    selectedArtifacts,
    resumeBullets,
    coverLetter,
  };
}

class InMemoryApplicationRepository {
  constructor() {
    this.applications = [];
    this.experiments = [];
  }

  saveApplication(application) {
    this.applications.push(application);
    return application;
  }

  listApplications() {
    return [...this.applications];
  }

  saveExperimentOutcome(outcome) {
    this.experiments.push(outcome);
    return outcome;
  }

  listExperimentOutcomes() {
    return [...this.experiments];
  }
}

function createSubmissionWorkflow({
  application,
  formFields = [],
  requiresCaptcha = false,
  approvalAssignee = 'candidate',
}) {
  return {
    application,
    formFields,
    requiresCaptcha,
    approvalAssignee,
    status: 'awaiting-human-approval',
    history: [`awaiting approval from ${approvalAssignee}`],
    submittedForm: null,
  };
}

function advanceSubmissionWorkflow(workflow, event) {
  if (workflow.status === 'submitted') {
    return workflow;
  }

  if (workflow.status === 'awaiting-human-approval') {
    if (event.type !== 'approve' || !event.actor) {
      return {
        ...workflow,
        history: [...workflow.history, 'approval still pending'],
      };
    }

    const nextStatus = workflow.requiresCaptcha ? 'awaiting-human-captcha' : 'ready-to-submit';

    return {
      ...workflow,
      status: nextStatus,
      history: [...workflow.history, `approved by ${event.actor}`],
    };
  }

  if (workflow.status === 'awaiting-human-captcha') {
    if (event.type !== 'captcha-solved' || !event.actor) {
      return {
        ...workflow,
        history: [...workflow.history, 'captcha still pending human action'],
      };
    }

    return {
      ...workflow,
      status: 'ready-to-submit',
      history: [...workflow.history, `captcha solved by ${event.actor}`],
    };
  }

  if (workflow.status === 'ready-to-submit') {
    if (event.type !== 'submit' || !event.formValues) {
      return {
        ...workflow,
        history: [...workflow.history, 'submission payload missing'],
      };
    }

    return {
      ...workflow,
      status: 'submitted',
      submittedForm: event.formValues,
      history: [...workflow.history, 'application submitted'],
    };
  }

  return workflow;
}

class ApplicationAnalytics {
  constructor(repository) {
    this.repository = repository;
  }

  recordOutcome({ company, variant, outcome }) {
    return this.repository.saveExperimentOutcome({ company, variant, outcome });
  }

  summarize() {
    const summary = new Map();

    for (const item of this.repository.listExperimentOutcomes()) {
      const existing = summary.get(item.variant) ?? {
        variant: item.variant,
        total: 0,
        callbacks: 0,
        interviews: 0,
      };

      existing.total += 1;
      if (item.outcome === 'callback' || item.outcome === 'interview') {
        existing.callbacks += 1;
      }
      if (item.outcome === 'interview') {
        existing.interviews += 1;
      }

      summary.set(item.variant, existing);
    }

    return Array.from(summary.values())
      .map((item) => ({
        ...item,
        callbackRate: item.total === 0 ? 0 : item.callbacks / item.total,
        interviewRate: item.total === 0 ? 0 : item.interviews / item.total,
      }))
      .sort((left, right) => left.variant.localeCompare(right.variant));
  }
}

module.exports = {
  ApplicationAnalytics,
  InMemoryApplicationRepository,
  advanceSubmissionWorkflow,
  buildWorkPortfolio,
  createSubmissionWorkflow,
  tailorApplication,
};
