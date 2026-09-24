'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ApplicationAnalytics,
  InMemoryApplicationRepository,
  advanceSubmissionWorkflow,
  buildWorkPortfolio,
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

test('submission workflow requires human approval and human captcha handling before submission', () => {
  const workflow = createSubmissionWorkflow({
    application: { id: 'app-1' },
    formFields: ['name', 'email', 'resume'],
    requiresCaptcha: true,
    approvalAssignee: 'joel',
  });

  const approved = advanceSubmissionWorkflow(workflow, {
    type: 'approve',
    actor: 'joel',
  });
  const captchaSolved = advanceSubmissionWorkflow(approved, {
    type: 'captcha-solved',
    actor: 'joel',
  });
  const submitted = advanceSubmissionWorkflow(captchaSolved, {
    type: 'submit',
    formValues: {
      name: 'Joel Teply',
      email: 'joel@example.com',
      resume: 'resume.pdf',
    },
  });

  assert.equal(workflow.status, 'awaiting-human-approval');
  assert.equal(approved.status, 'awaiting-human-captcha');
  assert.equal(captchaSolved.status, 'ready-to-submit');
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.submittedForm.resume, 'resume.pdf');
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
