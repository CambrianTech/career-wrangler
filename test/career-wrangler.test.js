'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ApplicationAnalytics,
  InMemoryApplicationRepository,
  advanceSubmissionWorkflow,
  buildWorkPortfolio,
  createContinuumRecipe,
  createSubmissionWorkflow,
  tailorApplication,
} = require('../src/index.js');

test('builds a portfolio from github and portfolio artifacts and tailors output in the candidate voice', () => {
  const portfolio = buildWorkPortfolio({
    githubArtifacts: [
      {
        title: 'Rust job pipeline',
        summary: 'Built ingestion for job leads and resume evidence.',
        skills: ['Rust', 'ORM', 'Analytics'],
      },
    ],
    portfolioArtifacts: [
      {
        title: 'TypeScript application agent',
        summary: 'Automated application drafting with human approval gates.',
        skills: ['TypeScript', 'Playwright', 'Analytics'],
      },
    ],
  });

  const application = tailorApplication({
    portfolio,
    position: {
      title: 'Senior Applied AI Engineer',
      company: 'CambrianTech',
      hiringTeam: 'CambrianTech team',
      skills: ['TypeScript', 'Rust', 'Analytics'],
    },
    voiceProfile: {
      preferredPhrase: 'I write systems that learn from real usage',
    },
  });

  assert.equal(portfolio.artifacts.length, 2);
  assert.equal(portfolio.strengths[0].skill, 'Analytics');
  assert.deepEqual(
    portfolio.strengths.slice(1).map((entry) => entry.skill).sort(),
    ['ORM', 'Playwright', 'Rust', 'TypeScript']
  );
  assert.match(application.resumeBullets[0], /I write systems that learn from real usage/);
  assert.match(application.coverLetter, /CambrianTech/);
});

test('continuum recipe emits AIRC commands and delegates playwright/captcha to continuum', () => {
  const portfolio = buildWorkPortfolio({
    githubArtifacts: [
      {
        title: 'Continuum orchestration',
        summary: 'Directed job automation through persistent personas.',
        skills: ['TypeScript', 'AIRC', 'Continuum'],
      },
    ],
  });

  const recipe = createContinuumRecipe({
    portfolio,
    position: {
      title: 'Staff AI Engineer',
      company: 'Example Co',
      skills: ['TypeScript', 'Continuum'],
    },
    voiceProfile: {
      preferredPhrase: 'I build systems that keep learning after launch',
    },
    persona: 'career-guide',
    room: '#cambriantech',
  });

  assert.equal(recipe.persona, 'career-guide');
  assert.equal(recipe.commands.length, 3);
  assert.equal(recipe.commands[0].transport, 'airc');
  assert.equal(recipe.commands[0].command, 'continuum.career.search-jobs');
  assert.deepEqual(recipe.commands[2].capabilities, ['persona', 'playwright', 'captcha', 'form-submission']);
  assert.equal(recipe.commands[2].payload.automation.owner, 'continuum');
});

test('submission workflow requires human approval before dispatching to continuum and accepts continuum results', () => {
  const recipe = {
    persona: 'career-guide',
    room: '#cambriantech',
  };

  const workflow = createSubmissionWorkflow({
    recipe,
    approvalAssignee: 'joel',
  });
  const approved = advanceSubmissionWorkflow(workflow, {
    type: 'approve',
    actor: 'joel',
  });
  const dispatched = advanceSubmissionWorkflow(approved, {
    type: 'dispatch',
    dispatchId: 'dispatch-1',
  });
  const submitted = advanceSubmissionWorkflow(dispatched, {
    type: 'continuum-result',
    result: {
      status: 'submitted',
      externalApplicationId: 'app-1',
    },
  });

  assert.equal(workflow.status, 'awaiting-human-approval');
  assert.equal(approved.status, 'ready-to-dispatch');
  assert.equal(dispatched.status, 'awaiting-continuum-result');
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.dispatch.id, 'dispatch-1');
  assert.equal(submitted.result.externalApplicationId, 'app-1');
});

test('analytics summarizes A/B/N outcomes for callbacks and interviews', () => {
  const repository = new InMemoryApplicationRepository();
  const analytics = new ApplicationAnalytics(repository);

  analytics.recordOutcome({ company: 'A Co', variant: 'A', outcome: 'rejected' });
  analytics.recordOutcome({ company: 'B Co', variant: 'A', outcome: 'callback' });
  analytics.recordOutcome({ company: 'C Co', variant: 'B', outcome: 'interview' });

  const summary = analytics.summarize();

  assert.deepEqual(summary, [
    {
      variant: 'A',
      total: 2,
      callbacks: 1,
      interviews: 0,
      callbackRate: 0.5,
      interviewRate: 0,
    },
    {
      variant: 'B',
      total: 1,
      callbacks: 1,
      interviews: 1,
      callbackRate: 1,
      interviewRate: 1,
    },
  ]);
});
