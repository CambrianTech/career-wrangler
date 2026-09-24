use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum ArtifactSource {
    Github,
    Portfolio,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PortfolioArtifact {
    pub id: String,
    pub source: ArtifactSource,
    pub title: String,
    pub organization: Option<String>,
    pub summary: String,
    pub skills: Vec<String>,
    pub evidence: Option<String>,
}

impl PortfolioArtifact {
    pub fn normalized(
        id: Option<String>,
        source: Option<ArtifactSource>,
        default_source: ArtifactSource,
        title: impl Into<String>,
        organization: Option<String>,
        summary: Option<String>,
        skills: Vec<String>,
        evidence: Option<String>,
    ) -> Self {
        let title = title.into();
        let source = source.unwrap_or(default_source);
        let mut normalized_skills = Vec::<String>::new();

        for skill in skills {
            let trimmed = skill.trim();
            if !trimmed.is_empty() && !normalized_skills.iter().any(|existing| existing == trimmed)
            {
                normalized_skills.push(trimmed.to_owned());
            }
        }

        Self {
            id: id.unwrap_or_else(|| format!("{}:{title}", source.as_str())),
            source,
            title,
            organization,
            summary: summary.unwrap_or_default(),
            skills: normalized_skills,
            evidence,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SkillStrength {
    pub skill: String,
    pub count: usize,
    pub sources: Vec<ArtifactSource>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct WorkPortfolio {
    pub artifacts: Vec<PortfolioArtifact>,
    pub strengths: Vec<SkillStrength>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct Position {
    pub title: String,
    pub company: String,
    pub hiring_team: Option<String>,
    pub skills: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct VoiceProfile {
    pub preferred_phrase: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ApplicationDraft {
    pub variant: String,
    pub position: Position,
    pub selected_artifacts: Vec<PortfolioArtifact>,
    pub resume_bullets: Vec<String>,
    pub cover_letter: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum CommandTransport {
    Airc,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
#[ts(export)]
pub enum ContinuumCommand {
    SearchJobs,
    GenerateMaterials,
    SubmitApplication,
}

impl ContinuumCommand {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SearchJobs => "continuum.career.search-jobs",
            Self::GenerateMaterials => "continuum.career.generate-materials",
            Self::SubmitApplication => "continuum.career.submit-application",
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SearchJobsPayload {
    pub title: String,
    pub company: String,
    pub skills: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct GenerateMaterialsPayload {
    pub variant: String,
    pub position: Position,
    pub voice_profile: VoiceProfile,
    pub selected_artifacts: Vec<PortfolioArtifact>,
    pub resume_bullets: Vec<String>,
    pub cover_letter: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct AutomationDelegation {
    pub owner: String,
    pub responsibilities: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SubmitApplicationPayload {
    pub variant: String,
    pub position: Position,
    pub voice_profile: VoiceProfile,
    pub selected_artifacts: Vec<PortfolioArtifact>,
    pub resume_bullets: Vec<String>,
    pub cover_letter: String,
    pub automation: AutomationDelegation,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
#[ts(export)]
pub enum AircCommandPayload {
    SearchJobs(SearchJobsPayload),
    GenerateMaterials(GenerateMaterialsPayload),
    SubmitApplication(SubmitApplicationPayload),
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct AircCommand {
    pub transport: CommandTransport,
    pub room: String,
    pub persona: String,
    pub command: String,
    pub payload: AircCommandPayload,
    pub capabilities: Vec<String>,
    pub human_approval_required: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ContinuumRecipe {
    pub persona: String,
    pub room: String,
    pub variant: String,
    pub application: ApplicationDraft,
    pub commands: Vec<AircCommand>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum SubmissionWorkflowStatus {
    AwaitingHumanApproval,
    ReadyToDispatch,
    AwaitingContinuumResult,
    Submitted,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ContinuumResultStatus {
    Submitted,
    NeedsHumanInput,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SubmissionDispatch {
    pub id: String,
    pub persona: String,
    pub room: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ContinuumResult {
    pub status: ContinuumResultStatus,
    pub external_application_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SubmissionWorkflow {
    pub recipe: ContinuumRecipe,
    pub approval_assignee: String,
    pub status: SubmissionWorkflowStatus,
    pub history: Vec<String>,
    pub dispatch: Option<SubmissionDispatch>,
    pub result: Option<ContinuumResult>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
#[ts(export)]
pub enum SubmissionEvent {
    Approve {
        actor: String,
    },
    Dispatch {
        dispatch_id: String,
        persona: Option<String>,
        room: Option<String>,
    },
    ContinuumResult {
        result: ContinuumResult,
    },
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct InMemoryApplicationRepository {
    pub applications: Vec<ApplicationDraft>,
    pub experiments: Vec<ExperimentOutcome>,
}

impl InMemoryApplicationRepository {
    pub fn save_application(&mut self, application: ApplicationDraft) -> ApplicationDraft {
        self.applications.push(application.clone());
        application
    }

    pub fn list_applications(&self) -> Vec<ApplicationDraft> {
        self.applications.clone()
    }

    pub fn save_experiment_outcome(&mut self, outcome: ExperimentOutcome) -> ExperimentOutcome {
        self.experiments.push(outcome.clone());
        outcome
    }

    pub fn list_experiment_outcomes(&self) -> Vec<ExperimentOutcome> {
        self.experiments.clone()
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ExperimentOutcome {
    pub company: String,
    pub variant: String,
    pub outcome: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct AnalyticsSummary {
    pub variant: String,
    pub total: usize,
    pub callbacks: usize,
    pub interviews: usize,
    pub callback_rate: f64,
    pub interview_rate: f64,
}

pub struct ApplicationAnalytics<'a> {
    repository: &'a mut InMemoryApplicationRepository,
}

impl<'a> ApplicationAnalytics<'a> {
    pub fn new(repository: &'a mut InMemoryApplicationRepository) -> Self {
        Self { repository }
    }

    pub fn record_outcome(
        &mut self,
        company: impl Into<String>,
        variant: impl Into<String>,
        outcome: impl Into<String>,
    ) {
        self.repository.save_experiment_outcome(ExperimentOutcome {
            company: company.into(),
            variant: variant.into(),
            outcome: outcome.into(),
        });
    }

    pub fn summarize(&self) -> Vec<AnalyticsSummary> {
        let mut summary = Vec::<AnalyticsSummary>::new();

        for item in self.repository.list_experiment_outcomes() {
            let existing = summary
                .iter_mut()
                .find(|entry| entry.variant == item.variant);
            let entry = match existing {
                Some(entry) => entry,
                None => {
                    summary.push(AnalyticsSummary {
                        variant: item.variant.clone(),
                        total: 0,
                        callbacks: 0,
                        interviews: 0,
                        callback_rate: 0.0,
                        interview_rate: 0.0,
                    });
                    summary
                        .iter_mut()
                        .find(|entry| entry.variant == item.variant)
                        .expect("newly inserted summary entry must exist")
                }
            };

            entry.total += 1;
            if item.outcome == "callback" || item.outcome == "interview" {
                entry.callbacks += 1;
            }
            if item.outcome == "interview" {
                entry.interviews += 1;
            }
        }

        for entry in &mut summary {
            if entry.total > 0 {
                entry.callback_rate = entry.callbacks as f64 / entry.total as f64;
                entry.interview_rate = entry.interviews as f64 / entry.total as f64;
            }
        }

        summary.sort_by(|left, right| left.variant.cmp(&right.variant));
        summary
    }
}

pub fn build_work_portfolio(
    github_artifacts: Vec<PortfolioArtifact>,
    portfolio_artifacts: Vec<PortfolioArtifact>,
) -> WorkPortfolio {
    let mut artifacts = github_artifacts;
    artifacts.extend(portfolio_artifacts);

    let mut strengths = Vec::<SkillStrength>::new();

    for artifact in &artifacts {
        for skill in &artifact.skills {
            let normalized = skill.to_lowercase();
            match strengths
                .iter_mut()
                .find(|entry| entry.skill.to_lowercase() == normalized)
            {
                Some(existing) => {
                    existing.count += 1;
                    if !existing.sources.contains(&artifact.source) {
                        existing.sources.push(artifact.source);
                        existing.sources.sort();
                    }
                }
                None => strengths.push(SkillStrength {
                    skill: skill.clone(),
                    count: 1,
                    sources: vec![artifact.source],
                }),
            }
        }
    }

    strengths.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| left.skill.cmp(&right.skill))
    });

    WorkPortfolio {
        artifacts,
        strengths,
    }
}

pub fn tailor_application(
    portfolio: &WorkPortfolio,
    position: Position,
    voice_profile: VoiceProfile,
    variant: impl Into<String>,
) -> ApplicationDraft {
    let variant = variant.into();
    let position_skill_lookup: Vec<String> = position
        .skills
        .iter()
        .map(|skill| skill.to_lowercase())
        .collect();

    let mut ranked_artifacts = portfolio
        .artifacts
        .iter()
        .map(|artifact| {
            let score = artifact
                .skills
                .iter()
                .filter(|skill| position_skill_lookup.contains(&skill.to_lowercase()))
                .count();
            (artifact.clone(), score)
        })
        .filter(|(_, score)| *score > 0)
        .collect::<Vec<_>>();

    ranked_artifacts.sort_by(
        |(left_artifact, left_score), (right_artifact, right_score)| {
            right_score
                .cmp(left_score)
                .then_with(|| left_artifact.title.cmp(&right_artifact.title))
        },
    );

    let selected_artifacts = ranked_artifacts
        .into_iter()
        .take(3)
        .map(|(artifact, _)| artifact)
        .collect::<Vec<_>>();

    let preferred_phrase = voice_profile
        .preferred_phrase
        .clone()
        .unwrap_or_else(|| "I focus on practical results".to_owned());

    let resume_bullets = selected_artifacts
        .iter()
        .map(|artifact| {
            let matched_skills = artifact
                .skills
                .iter()
                .filter(|skill| position_skill_lookup.contains(&skill.to_lowercase()))
                .cloned()
                .collect::<Vec<_>>()
                .join(", ");
            format!(
                "{preferred_phrase}: {} applied {matched_skills} through {} experience.",
                artifact.title,
                artifact.source.as_str()
            )
        })
        .collect::<Vec<_>>();

    let unique_sources =
        selected_artifacts
            .iter()
            .fold(Vec::<String>::new(), |mut sources, artifact| {
                let source = artifact.source.as_str().to_owned();
                if !sources.contains(&source) {
                    sources.push(source);
                }
                sources
            });

    let mut cover_letter_sections = vec![
        format!(
            "Hi {},",
            position
                .hiring_team
                .clone()
                .unwrap_or_else(|| "hiring team".to_owned())
        ),
        format!(
            "I'm excited about the {} role because it matches work I've already shipped across {} experience.",
            position.title,
            unique_sources.join(" and ")
        ),
    ];

    cover_letter_sections.extend(selected_artifacts.iter().map(|artifact| {
        let organization = artifact
            .organization
            .as_ref()
            .map(|value| format!(" at {value}"))
            .unwrap_or_default();
        format!(
            "{preferred_phrase}, I can point to {}{organization}: {}",
            artifact.title, artifact.summary
        )
    }));
    cover_letter_sections.push(format!(
        "I'd like to bring the same approach to {}.",
        position.company
    ));

    ApplicationDraft {
        variant,
        position,
        selected_artifacts,
        resume_bullets,
        cover_letter: cover_letter_sections.join("\n\n"),
    }
}

pub fn create_airc_command(
    room: impl Into<String>,
    persona: impl Into<String>,
    command: ContinuumCommand,
    payload: AircCommandPayload,
    capabilities: Vec<String>,
    human_approval_required: bool,
) -> AircCommand {
    let mut unique_capabilities = Vec::<String>::new();
    for capability in capabilities {
        if !unique_capabilities.contains(&capability) {
            unique_capabilities.push(capability);
        }
    }

    AircCommand {
        transport: CommandTransport::Airc,
        room: room.into(),
        persona: persona.into(),
        command: command.as_str().to_owned(),
        payload,
        capabilities: unique_capabilities,
        human_approval_required,
    }
}

pub fn create_continuum_recipe(
    portfolio: &WorkPortfolio,
    position: Position,
    voice_profile: VoiceProfile,
    persona: impl Into<String>,
    room: impl Into<String>,
    variant: impl Into<String>,
) -> ContinuumRecipe {
    let persona = persona.into();
    let room = room.into();
    let variant = variant.into();
    let application = tailor_application(
        portfolio,
        position.clone(),
        voice_profile.clone(),
        variant.clone(),
    );

    let materials_payload = GenerateMaterialsPayload {
        variant: variant.clone(),
        position: position.clone(),
        voice_profile: voice_profile.clone(),
        selected_artifacts: application.selected_artifacts.clone(),
        resume_bullets: application.resume_bullets.clone(),
        cover_letter: application.cover_letter.clone(),
    };

    let submit_payload = SubmitApplicationPayload {
        variant: variant.clone(),
        position: position.clone(),
        voice_profile,
        selected_artifacts: application.selected_artifacts.clone(),
        resume_bullets: application.resume_bullets.clone(),
        cover_letter: application.cover_letter.clone(),
        automation: AutomationDelegation {
            owner: "continuum".to_owned(),
            responsibilities: vec![
                "playwright".to_owned(),
                "captcha".to_owned(),
                "form-submission".to_owned(),
            ],
        },
    };

    let commands = vec![
        create_airc_command(
            room.clone(),
            persona.clone(),
            ContinuumCommand::SearchJobs,
            AircCommandPayload::SearchJobs(SearchJobsPayload {
                title: position.title.clone(),
                company: position.company.clone(),
                skills: position.skills.clone(),
            }),
            vec!["persona".to_owned(), "job-search".to_owned()],
            true,
        ),
        create_airc_command(
            room.clone(),
            persona.clone(),
            ContinuumCommand::GenerateMaterials,
            AircCommandPayload::GenerateMaterials(materials_payload),
            vec![
                "persona".to_owned(),
                "resume-generation".to_owned(),
                "cover-letter-generation".to_owned(),
            ],
            true,
        ),
        create_airc_command(
            room.clone(),
            persona.clone(),
            ContinuumCommand::SubmitApplication,
            AircCommandPayload::SubmitApplication(submit_payload),
            vec![
                "persona".to_owned(),
                "playwright".to_owned(),
                "captcha".to_owned(),
                "form-submission".to_owned(),
            ],
            true,
        ),
    ];

    ContinuumRecipe {
        persona,
        room,
        variant,
        application,
        commands,
    }
}

pub fn create_submission_workflow(
    recipe: ContinuumRecipe,
    approval_assignee: impl Into<String>,
) -> SubmissionWorkflow {
    let approval_assignee = approval_assignee.into();

    SubmissionWorkflow {
        recipe,
        approval_assignee: approval_assignee.clone(),
        status: SubmissionWorkflowStatus::AwaitingHumanApproval,
        history: vec![format!("awaiting approval from {approval_assignee}")],
        dispatch: None,
        result: None,
    }
}

pub fn advance_submission_workflow(
    workflow: &SubmissionWorkflow,
    event: SubmissionEvent,
) -> SubmissionWorkflow {
    if workflow.status == SubmissionWorkflowStatus::Submitted {
        return workflow.clone();
    }

    match (&workflow.status, event) {
        (SubmissionWorkflowStatus::AwaitingHumanApproval, SubmissionEvent::Approve { actor }) => {
            let mut updated = workflow.clone();
            updated.status = SubmissionWorkflowStatus::ReadyToDispatch;
            updated.history.push(format!("approved by {actor}"));
            updated
        }
        (SubmissionWorkflowStatus::AwaitingHumanApproval, _) => {
            let mut updated = workflow.clone();
            updated.history.push("approval still pending".to_owned());
            updated
        }
        (
            SubmissionWorkflowStatus::ReadyToDispatch,
            SubmissionEvent::Dispatch {
                dispatch_id,
                persona,
                room,
            },
        ) => {
            let mut updated = workflow.clone();
            let persona = persona.unwrap_or_else(|| workflow.recipe.persona.clone());
            let room = room.unwrap_or_else(|| workflow.recipe.room.clone());
            updated.status = SubmissionWorkflowStatus::AwaitingContinuumResult;
            updated.dispatch = Some(SubmissionDispatch {
                id: dispatch_id,
                persona: persona.clone(),
                room: room.clone(),
            });
            updated
                .history
                .push(format!("dispatched to {persona} in {room}"));
            updated
        }
        (SubmissionWorkflowStatus::ReadyToDispatch, _) => {
            let mut updated = workflow.clone();
            updated.history.push("dispatch still pending".to_owned());
            updated
        }
        (
            SubmissionWorkflowStatus::AwaitingContinuumResult,
            SubmissionEvent::ContinuumResult { result },
        ) => {
            let mut updated = workflow.clone();
            updated.result = Some(result.clone());
            updated.status = match result.status {
                ContinuumResultStatus::Submitted => SubmissionWorkflowStatus::Submitted,
                ContinuumResultStatus::NeedsHumanInput => {
                    SubmissionWorkflowStatus::AwaitingHumanApproval
                }
            };
            updated.history.push(
                if updated.status == SubmissionWorkflowStatus::Submitted {
                    "continuum reported application submitted"
                } else {
                    "continuum requested additional human input"
                }
                .to_owned(),
            );
            updated
        }
        (SubmissionWorkflowStatus::AwaitingContinuumResult, _) => {
            let mut updated = workflow.clone();
            updated.history.push("awaiting continuum result".to_owned());
            updated
        }
        (SubmissionWorkflowStatus::Submitted, _) => workflow.clone(),
    }
}

impl ArtifactSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Github => "github",
            Self::Portfolio => "portfolio",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn github_artifact(title: &str, summary: &str, skills: &[&str]) -> PortfolioArtifact {
        PortfolioArtifact::normalized(
            None,
            Some(ArtifactSource::Github),
            ArtifactSource::Github,
            title,
            None,
            Some(summary.to_owned()),
            skills.iter().map(|value| value.to_string()).collect(),
            None,
        )
    }

    fn portfolio_artifact(title: &str, summary: &str, skills: &[&str]) -> PortfolioArtifact {
        PortfolioArtifact::normalized(
            None,
            Some(ArtifactSource::Portfolio),
            ArtifactSource::Portfolio,
            title,
            None,
            Some(summary.to_owned()),
            skills.iter().map(|value| value.to_string()).collect(),
            None,
        )
    }

    #[test]
    fn builds_a_portfolio_and_tailors_output_in_the_candidate_voice() {
        let portfolio = build_work_portfolio(
            vec![github_artifact(
                "Rust job pipeline",
                "Built ingestion for job leads and resume evidence.",
                &["Rust", "ORM", "Analytics"],
            )],
            vec![portfolio_artifact(
                "TypeScript application agent",
                "Automated application drafting with human approval gates.",
                &["TypeScript", "Playwright", "Analytics"],
            )],
        );

        let application = tailor_application(
            &portfolio,
            Position {
                title: "Senior Applied AI Engineer".to_owned(),
                company: "CambrianTech".to_owned(),
                hiring_team: Some("CambrianTech team".to_owned()),
                skills: vec![
                    "TypeScript".to_owned(),
                    "Rust".to_owned(),
                    "Analytics".to_owned(),
                ],
            },
            VoiceProfile {
                preferred_phrase: Some("I write systems that learn from real usage".to_owned()),
            },
            "A",
        );

        assert_eq!(portfolio.artifacts.len(), 2);
        assert_eq!(portfolio.strengths[0].skill, "Analytics");

        let mut trailing_skills = portfolio
            .strengths
            .iter()
            .skip(1)
            .map(|entry| entry.skill.as_str())
            .collect::<Vec<_>>();
        trailing_skills.sort();
        assert_eq!(
            trailing_skills,
            vec!["ORM", "Playwright", "Rust", "TypeScript"]
        );
        assert!(
            application.resume_bullets[0].contains("I write systems that learn from real usage")
        );
        assert!(application.cover_letter.contains("CambrianTech"));
    }

    #[test]
    fn continuum_recipe_emits_airc_commands_and_delegates_automation_to_continuum() {
        let portfolio = build_work_portfolio(
            vec![github_artifact(
                "Continuum orchestration",
                "Directed job automation through persistent personas.",
                &["TypeScript", "AIRC", "Continuum"],
            )],
            vec![],
        );

        let recipe = create_continuum_recipe(
            &portfolio,
            Position {
                title: "Staff AI Engineer".to_owned(),
                company: "Example Co".to_owned(),
                hiring_team: None,
                skills: vec!["TypeScript".to_owned(), "Continuum".to_owned()],
            },
            VoiceProfile {
                preferred_phrase: Some(
                    "I build systems that keep learning after launch".to_owned(),
                ),
            },
            "career-guide",
            "#cambriantech",
            "A",
        );

        assert_eq!(recipe.persona, "career-guide");
        assert_eq!(recipe.commands.len(), 3);
        assert_eq!(recipe.commands[0].transport, CommandTransport::Airc);
        assert_eq!(recipe.commands[0].command, "continuum.career.search-jobs");
        assert_eq!(
            recipe.commands[2].capabilities,
            vec!["persona", "playwright", "captcha", "form-submission"]
        );

        match &recipe.commands[2].payload {
            AircCommandPayload::SubmitApplication(payload) => {
                assert_eq!(payload.automation.owner, "continuum");
            }
            payload => panic!("unexpected payload: {payload:?}"),
        }
    }

    #[test]
    fn submission_workflow_requires_human_approval_before_dispatching_to_continuum() {
        let portfolio = build_work_portfolio(
            vec![github_artifact(
                "Job agent",
                "Used AIRC and Continuum",
                &["Rust"],
            )],
            vec![],
        );
        let recipe = create_continuum_recipe(
            &portfolio,
            Position {
                title: "AI Engineer".to_owned(),
                company: "Example".to_owned(),
                hiring_team: None,
                skills: vec!["Rust".to_owned()],
            },
            VoiceProfile::default(),
            "career-guide",
            "#cambriantech",
            "A",
        );
        let workflow = create_submission_workflow(recipe, "joel");
        let approved = advance_submission_workflow(
            &workflow,
            SubmissionEvent::Approve {
                actor: "joel".to_owned(),
            },
        );
        let dispatched = advance_submission_workflow(
            &approved,
            SubmissionEvent::Dispatch {
                dispatch_id: "dispatch-1".to_owned(),
                persona: None,
                room: None,
            },
        );
        let submitted = advance_submission_workflow(
            &dispatched,
            SubmissionEvent::ContinuumResult {
                result: ContinuumResult {
                    status: ContinuumResultStatus::Submitted,
                    external_application_id: Some("app-1".to_owned()),
                },
            },
        );

        assert_eq!(
            workflow.status,
            SubmissionWorkflowStatus::AwaitingHumanApproval
        );
        assert_eq!(approved.status, SubmissionWorkflowStatus::ReadyToDispatch);
        assert_eq!(
            dispatched.status,
            SubmissionWorkflowStatus::AwaitingContinuumResult
        );
        assert_eq!(submitted.status, SubmissionWorkflowStatus::Submitted);
        assert_eq!(submitted.dispatch.unwrap().id, "dispatch-1");
        assert_eq!(
            submitted.result.unwrap().external_application_id.as_deref(),
            Some("app-1")
        );
    }

    #[test]
    fn analytics_summarize_abn_outcomes() {
        let mut repository = InMemoryApplicationRepository::default();
        {
            let mut analytics = ApplicationAnalytics::new(&mut repository);
            analytics.record_outcome("A Co", "A", "rejected");
            analytics.record_outcome("B Co", "A", "callback");
            analytics.record_outcome("C Co", "B", "interview");
        }

        let analytics = ApplicationAnalytics::new(&mut repository);
        let summary = analytics.summarize();

        assert_eq!(
            summary,
            vec![
                AnalyticsSummary {
                    variant: "A".to_owned(),
                    total: 2,
                    callbacks: 1,
                    interviews: 0,
                    callback_rate: 0.5,
                    interview_rate: 0.0,
                },
                AnalyticsSummary {
                    variant: "B".to_owned(),
                    total: 1,
                    callbacks: 1,
                    interviews: 1,
                    callback_rate: 1.0,
                    interview_rate: 1.0,
                }
            ]
        );
    }
}
