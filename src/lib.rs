use serde::{Deserialize, Serialize};
use ts_rs::TS;

const SCHEMA_VERSION: &str = "career-wrangler/v1alpha1";

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ArtifactSource {
    WorkHistory,
    Github,
    Project,
    WritingSample,
}

impl ArtifactSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WorkHistory => "work_history",
            Self::Github => "github",
            Self::Project => "project",
            Self::WritingSample => "writing_sample",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct IdentityProfile {
    pub full_name: String,
    pub headline: String,
    pub summary: String,
    pub location: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct WorkHistoryItem {
    pub company: String,
    pub role: String,
    pub summary: String,
    pub skills: Vec<String>,
    pub domain_tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ProjectSource {
    pub title: String,
    pub summary: String,
    pub repository: Option<String>,
    pub skills: Vec<String>,
    pub domain_tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct GithubEvidence {
    pub repository: String,
    pub title: String,
    pub summary: String,
    pub skills: Vec<String>,
    pub domain_tags: Vec<String>,
    pub url: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SkillTag {
    pub skill: String,
    pub domains: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct VoiceExample {
    pub job_family: String,
    pub exemplar: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct TargetPreferences {
    pub preferred_roles: Vec<String>,
    pub preferred_companies: Vec<String>,
    pub preferred_locations: Vec<String>,
    pub keywords: Vec<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum OutcomeStatus {
    Drafted,
    Submitted,
    Callback,
    Interview,
    Rejected,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PriorApplicationRecord {
    pub company: String,
    pub role: String,
    pub role_family: String,
    pub variant_id: String,
    pub status: OutcomeStatus,
    pub notes: Option<String>,
    pub rejection_reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ApprovalPolicy {
    pub approvers: Vec<String>,
    pub checkpoints: Vec<String>,
    pub require_human_approval: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct UserSourceBundle {
    pub schema_version: String,
    pub identity_profile: IdentityProfile,
    pub work_history: Vec<WorkHistoryItem>,
    pub projects: Vec<ProjectSource>,
    pub github_evidence: Vec<GithubEvidence>,
    pub skill_tags: Vec<SkillTag>,
    pub voice_examples: Vec<VoiceExample>,
    pub target_preferences: TargetPreferences,
    pub prior_applications: Vec<PriorApplicationRecord>,
    pub approval_policy: ApprovalPolicy,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ScoringWeights {
    pub skill_match_weight: u32,
    pub domain_match_weight: u32,
    pub evidence_bonus_weight: u32,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ForkConfig {
    pub schema_version: String,
    pub user_id: String,
    pub source_root: String,
    pub preferred_persona: String,
    pub preferred_room: String,
    pub scoring_weights: ScoringWeights,
    pub job_search_scope: Vec<String>,
    pub voice_constraints: Vec<String>,
    pub experimentation_rules: Vec<String>,
    pub output_template: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PortfolioArtifact {
    pub id: String,
    pub source: ArtifactSource,
    pub title: String,
    pub organization: Option<String>,
    pub summary: String,
    pub skills: Vec<String>,
    pub domain_tags: Vec<String>,
    pub evidence: Option<String>,
}

impl PortfolioArtifact {
    pub fn normalized(
        id: Option<String>,
        source: ArtifactSource,
        title: impl Into<String>,
        organization: Option<String>,
        summary: impl Into<String>,
        skills: Vec<String>,
        domain_tags: Vec<String>,
        evidence: Option<String>,
    ) -> Self {
        let title = title.into();
        Self {
            id: id.unwrap_or_else(|| format!("{}:{}", source.as_str(), slugify(&title))),
            source,
            title,
            organization,
            summary: summary.into(),
            skills: unique_strings(skills),
            domain_tags: unique_strings(domain_tags),
            evidence,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SkillStrength {
    pub skill: String,
    pub count: usize,
    pub sources: Vec<ArtifactSource>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct WorkPortfolio {
    pub artifacts: Vec<PortfolioArtifact>,
    pub strengths: Vec<SkillStrength>,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct VoiceProfile {
    pub preferred_phrase: Option<String>,
    pub exemplars: Vec<String>,
    pub constraints: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct NormalizedPortfolio {
    pub schema_version: String,
    pub user_id: String,
    pub profile: IdentityProfile,
    pub portfolio: WorkPortfolio,
    pub voice_profile: VoiceProfile,
    pub target_preferences: TargetPreferences,
    pub approval_policy: ApprovalPolicy,
    pub prior_applications: Vec<PriorApplicationRecord>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ApplicationQuestion {
    pub prompt: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct JobDossier {
    pub schema_version: String,
    pub company: String,
    pub title: String,
    pub role_family: String,
    pub hiring_team: Option<String>,
    pub skills: Vec<String>,
    pub domain_tags: Vec<String>,
    pub responsibilities: Vec<String>,
    pub application_questions: Vec<ApplicationQuestion>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct RankedArtifact {
    pub artifact: PortfolioArtifact,
    pub score: u32,
    pub matched_skills: Vec<String>,
    pub matched_domains: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct EvidencePack {
    pub key: String,
    pub label: String,
    pub supporting_skills: Vec<String>,
    pub supporting_domains: Vec<String>,
    pub artifact_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct RankedEvidenceSet {
    pub schema_version: String,
    pub variant_id: String,
    pub company: String,
    pub role_family: String,
    pub ranked_artifacts: Vec<RankedArtifact>,
    pub evidence_packs: Vec<EvidencePack>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct TailoredResume {
    pub schema_version: String,
    pub variant_id: String,
    pub headline: String,
    pub summary: String,
    pub bullets: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct TailoredCoverLetter {
    pub schema_version: String,
    pub variant_id: String,
    pub content: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct GeneratedAnswer {
    pub question: String,
    pub answer: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ApplicationPackage {
    pub schema_version: String,
    pub variant_id: String,
    pub company: String,
    pub role_family: String,
    pub resume: TailoredResume,
    pub cover_letter: TailoredCoverLetter,
    pub generated_answers: Vec<GeneratedAnswer>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ContinuumPhase {
    FindOpportunities,
    EnrichOpportunity,
    GenerateMaterials,
    RequestApproval,
    Submit,
    ReportOutcome,
    AnalyzeExperiments,
}

impl ContinuumPhase {
    pub fn as_command(self) -> &'static str {
        match self {
            Self::FindOpportunities => "continuum.career.find-opportunities",
            Self::EnrichOpportunity => "continuum.career.enrich-opportunity",
            Self::GenerateMaterials => "continuum.career.generate-materials",
            Self::RequestApproval => "continuum.career.request-approval",
            Self::Submit => "continuum.career.submit",
            Self::ReportOutcome => "continuum.career.report-outcome",
            Self::AnalyzeExperiments => "continuum.career.analyze-experiments",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum CommandTransport {
    Airc,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PhaseContext {
    pub variant_id: String,
    pub role_family: String,
    pub company: String,
    pub summary: String,
    pub approval_checkpoints: Vec<String>,
    pub responsibilities: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct AircCommand {
    pub transport: CommandTransport,
    pub room: String,
    pub persona: String,
    pub phase: ContinuumPhase,
    pub command: String,
    pub payload: PhaseContext,
    pub capabilities: Vec<String>,
    pub human_approval_required: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ContinuumRecipe {
    pub schema_version: String,
    pub variant_id: String,
    pub persona: String,
    pub room: String,
    pub commands: Vec<AircCommand>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum PipelineStageKind {
    SourceIngestion,
    EvidenceShaping,
    ApplicationGeneration,
    OutcomeCapture,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PipelineStage {
    pub stage: PipelineStageKind,
    pub description: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum SubmissionStatus {
    AwaitingApproval,
    Submitted,
    Callback,
    Interview,
    Rejected,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ApprovalDecision {
    pub checkpoint: String,
    pub actor: String,
    pub approved: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SubmissionRecord {
    pub schema_version: String,
    pub variant_id: String,
    pub company: String,
    pub role_family: String,
    pub status: SubmissionStatus,
    pub approvals: Vec<ApprovalDecision>,
    pub feedback: Option<String>,
    pub rejection_reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ExecutionBoundary {
    pub schema_version: String,
    pub project_is_source_of_truth: bool,
    pub continuum_recipe_required: bool,
    pub notes: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PipelineOutputs {
    pub schema_version: String,
    pub stages: Vec<PipelineStage>,
    pub execution_boundary: ExecutionBoundary,
    pub normalized_portfolio: NormalizedPortfolio,
    pub ranked_evidence: RankedEvidenceSet,
    pub application_package: ApplicationPackage,
    pub continuum_recipe: ContinuumRecipe,
    pub submission_record: SubmissionRecord,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct InMemoryApplicationRepository {
    pub packages: Vec<ApplicationPackage>,
    pub submissions: Vec<SubmissionRecord>,
    pub experiments: Vec<ExperimentOutcome>,
}

impl InMemoryApplicationRepository {
    pub fn save_package(&mut self, package: ApplicationPackage) -> ApplicationPackage {
        self.packages.push(package.clone());
        package
    }

    pub fn save_submission(&mut self, submission: SubmissionRecord) -> SubmissionRecord {
        self.submissions.push(submission.clone());
        submission
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
    pub variant_id: String,
    pub company: String,
    pub role_family: String,
    pub outcome: OutcomeStatus,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct AnalyticsSummary {
    pub variant_id: String,
    pub company: String,
    pub role_family: String,
    pub total: usize,
    pub callbacks: usize,
    pub interviews: usize,
    pub rejections: usize,
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
        variant_id: impl Into<String>,
        company: impl Into<String>,
        role_family: impl Into<String>,
        outcome: OutcomeStatus,
    ) {
        self.repository.save_experiment_outcome(ExperimentOutcome {
            variant_id: variant_id.into(),
            company: company.into(),
            role_family: role_family.into(),
            outcome,
        });
    }

    pub fn summarize(&self) -> Vec<AnalyticsSummary> {
        let mut summaries = Vec::<AnalyticsSummary>::new();

        for item in self.repository.list_experiment_outcomes() {
            let existing = summaries.iter_mut().find(|entry| {
                entry.variant_id == item.variant_id
                    && entry.company == item.company
                    && entry.role_family == item.role_family
            });
            let entry = match existing {
                Some(entry) => entry,
                None => {
                    summaries.push(AnalyticsSummary {
                        variant_id: item.variant_id.clone(),
                        company: item.company.clone(),
                        role_family: item.role_family.clone(),
                        total: 0,
                        callbacks: 0,
                        interviews: 0,
                        rejections: 0,
                        callback_rate: 0.0,
                        interview_rate: 0.0,
                    });
                    summaries
                        .iter_mut()
                        .find(|entry| {
                            entry.variant_id == item.variant_id
                                && entry.company == item.company
                                && entry.role_family == item.role_family
                        })
                        .expect("newly inserted analytics summary must exist")
                }
            };

            entry.total += 1;
            match item.outcome {
                OutcomeStatus::Callback => entry.callbacks += 1,
                OutcomeStatus::Interview => {
                    entry.callbacks += 1;
                    entry.interviews += 1;
                }
                OutcomeStatus::Rejected => entry.rejections += 1,
                OutcomeStatus::Drafted | OutcomeStatus::Submitted => {}
            }
        }

        for entry in &mut summaries {
            if entry.total > 0 {
                entry.callback_rate = entry.callbacks as f64 / entry.total as f64;
                entry.interview_rate = entry.interviews as f64 / entry.total as f64;
            }
        }

        summaries.sort_by(|left, right| left.variant_id.cmp(&right.variant_id));
        summaries
    }
}

pub fn normalize_user_sources(
    config: &ForkConfig,
    sources: &UserSourceBundle,
) -> NormalizedPortfolio {
    let mut artifacts = Vec::<PortfolioArtifact>::new();

    for item in &sources.work_history {
        artifacts.push(PortfolioArtifact::normalized(
            None,
            ArtifactSource::WorkHistory,
            format!("{} @ {}", item.role, item.company),
            Some(item.company.clone()),
            item.summary.clone(),
            item.skills.clone(),
            item.domain_tags.clone(),
            None,
        ));
    }

    for item in &sources.projects {
        artifacts.push(PortfolioArtifact::normalized(
            None,
            ArtifactSource::Project,
            item.title.clone(),
            None,
            item.summary.clone(),
            item.skills.clone(),
            item.domain_tags.clone(),
            item.repository.clone(),
        ));
    }

    for item in &sources.github_evidence {
        artifacts.push(PortfolioArtifact::normalized(
            None,
            ArtifactSource::Github,
            item.title.clone(),
            Some(item.repository.clone()),
            item.summary.clone(),
            item.skills.clone(),
            item.domain_tags.clone(),
            item.url.clone(),
        ));
    }

    for item in &sources.voice_examples {
        artifacts.push(PortfolioArtifact::normalized(
            None,
            ArtifactSource::WritingSample,
            format!("Voice exemplar: {}", item.job_family),
            None,
            item.exemplar.clone(),
            sources
                .skill_tags
                .iter()
                .map(|tag| tag.skill.clone())
                .take(3)
                .collect(),
            vec![item.job_family.clone()],
            None,
        ));
    }

    let portfolio = build_work_portfolio(artifacts);
    let voice_profile = VoiceProfile {
        preferred_phrase: sources
            .voice_examples
            .first()
            .map(|example| compact_phrase(&example.exemplar)),
        exemplars: sources
            .voice_examples
            .iter()
            .map(|example| example.exemplar.clone())
            .collect(),
        constraints: config.voice_constraints.clone(),
    };

    NormalizedPortfolio {
        schema_version: SCHEMA_VERSION.to_owned(),
        user_id: config.user_id.clone(),
        profile: sources.identity_profile.clone(),
        portfolio,
        voice_profile,
        target_preferences: sources.target_preferences.clone(),
        approval_policy: sources.approval_policy.clone(),
        prior_applications: sources.prior_applications.clone(),
    }
}

pub fn build_work_portfolio(artifacts: Vec<PortfolioArtifact>) -> WorkPortfolio {
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

pub fn build_variant_id(config: &ForkConfig, dossier: &JobDossier, track: &str) -> String {
    format!(
        "{}-{}-{}-{}",
        slugify(&config.user_id),
        slugify(&dossier.role_family),
        slugify(&dossier.company),
        slugify(track)
    )
}

pub fn build_ranked_evidence(
    normalized: &NormalizedPortfolio,
    dossier: &JobDossier,
    config: &ForkConfig,
    variant_id: impl Into<String>,
) -> RankedEvidenceSet {
    let variant_id = variant_id.into();
    let dossier_skills = lowercased(&dossier.skills);
    let dossier_domains = lowercased(&dossier.domain_tags);

    let mut ranked_artifacts = normalized
        .portfolio
        .artifacts
        .iter()
        .map(|artifact| {
            let matched_skills = artifact
                .skills
                .iter()
                .filter(|skill| dossier_skills.contains(&skill.to_lowercase()))
                .cloned()
                .collect::<Vec<_>>();
            let matched_domains = artifact
                .domain_tags
                .iter()
                .filter(|domain| dossier_domains.contains(&domain.to_lowercase()))
                .cloned()
                .collect::<Vec<_>>();
            let mut score = matched_skills.len() as u32 * config.scoring_weights.skill_match_weight;
            score += matched_domains.len() as u32 * config.scoring_weights.domain_match_weight;
            if artifact.evidence.is_some() {
                score += config.scoring_weights.evidence_bonus_weight;
            }
            RankedArtifact {
                artifact: artifact.clone(),
                score,
                matched_skills,
                matched_domains,
            }
        })
        .filter(|artifact| artifact.score > 0)
        .collect::<Vec<_>>();

    ranked_artifacts.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.artifact.title.cmp(&right.artifact.title))
    });

    let mut evidence_packs = Vec::<EvidencePack>::new();
    for artifact in ranked_artifacts.iter().take(5) {
        let key_parts = if !artifact.matched_skills.is_empty() {
            unique_strings(artifact.matched_skills.clone())
        } else {
            unique_strings(artifact.matched_domains.clone())
        };
        let key = if key_parts.is_empty() {
            format!("artifact:{}", artifact.artifact.id)
        } else {
            format!("pack:{}", key_parts.join("+"))
        };
        match evidence_packs.iter_mut().find(|pack| pack.key == key) {
            Some(existing) => {
                if !existing.artifact_ids.contains(&artifact.artifact.id) {
                    existing.artifact_ids.push(artifact.artifact.id.clone());
                }
                existing.supporting_skills =
                    merge_unique(&existing.supporting_skills, &artifact.matched_skills);
                existing.supporting_domains =
                    merge_unique(&existing.supporting_domains, &artifact.matched_domains);
            }
            None => evidence_packs.push(EvidencePack {
                key: key.clone(),
                label: key_parts.join(" / "),
                supporting_skills: unique_strings(artifact.matched_skills.clone()),
                supporting_domains: unique_strings(artifact.matched_domains.clone()),
                artifact_ids: vec![artifact.artifact.id.clone()],
            }),
        }
    }

    RankedEvidenceSet {
        schema_version: SCHEMA_VERSION.to_owned(),
        variant_id,
        company: dossier.company.clone(),
        role_family: dossier.role_family.clone(),
        ranked_artifacts,
        evidence_packs,
    }
}

pub fn generate_application_package(
    normalized: &NormalizedPortfolio,
    dossier: &JobDossier,
    evidence: &RankedEvidenceSet,
    variant_id: impl Into<String>,
) -> ApplicationPackage {
    let variant_id = variant_id.into();
    let preferred_phrase = normalized
        .voice_profile
        .preferred_phrase
        .clone()
        .unwrap_or_else(|| "I focus on practical results".to_owned());
    let top_artifacts = evidence.ranked_artifacts.iter().take(4).collect::<Vec<_>>();

    let bullets = top_artifacts
        .iter()
        .map(|artifact| {
            let skills = if artifact.matched_skills.is_empty() {
                artifact.artifact.skills.join(", ")
            } else {
                artifact.matched_skills.join(", ")
            };
            format!(
                "{preferred_phrase}: {} shows {} through {}.",
                artifact.artifact.title,
                skills,
                artifact.artifact.source.as_str()
            )
        })
        .collect::<Vec<_>>();

    let summary = format!(
        "{} applying reusable evidence packs for {} roles.",
        normalized.profile.headline, dossier.role_family
    );

    let cover_letter = TailoredCoverLetter {
        schema_version: SCHEMA_VERSION.to_owned(),
        variant_id: variant_id.clone(),
        content: format!(
            "Hi {},\n\n{} {} role is a strong fit because my evidence set already covers {}.\n\n{}\n\nI'd like to bring that same approach to {}.",
            dossier
                .hiring_team
                .clone()
                .unwrap_or_else(|| "hiring team".to_owned()),
            normalized.profile.full_name,
            dossier.title,
            dossier.skills.join(", "),
            top_artifacts
                .iter()
                .map(|artifact| format!(
                    "{}: {}",
                    artifact.artifact.title, artifact.artifact.summary
                ))
                .collect::<Vec<_>>()
                .join("\n\n"),
            dossier.company
        ),
    };

    let generated_answers = dossier
        .application_questions
        .iter()
        .map(|question| GeneratedAnswer {
            question: question.prompt.clone(),
            answer: format!(
                "{} My strongest evidence for this is {}.",
                preferred_phrase,
                top_artifacts
                    .first()
                    .map(|artifact| artifact.artifact.summary.clone())
                    .unwrap_or_else(|| normalized.profile.summary.clone())
            ),
        })
        .collect::<Vec<_>>();

    ApplicationPackage {
        schema_version: SCHEMA_VERSION.to_owned(),
        variant_id: variant_id.clone(),
        company: dossier.company.clone(),
        role_family: dossier.role_family.clone(),
        resume: TailoredResume {
            schema_version: SCHEMA_VERSION.to_owned(),
            variant_id: variant_id.clone(),
            headline: normalized.profile.headline.clone(),
            summary,
            bullets,
        },
        cover_letter,
        generated_answers,
    }
}

pub fn create_continuum_recipe(
    config: &ForkConfig,
    dossier: &JobDossier,
    package: &ApplicationPackage,
    approval_policy: &ApprovalPolicy,
) -> ContinuumRecipe {
    let responsibilities = dossier.responsibilities.clone();
    let summary = package.resume.summary.clone();
    let phase_order = [
        ContinuumPhase::FindOpportunities,
        ContinuumPhase::EnrichOpportunity,
        ContinuumPhase::GenerateMaterials,
        ContinuumPhase::RequestApproval,
        ContinuumPhase::Submit,
        ContinuumPhase::ReportOutcome,
        ContinuumPhase::AnalyzeExperiments,
    ];

    let commands = phase_order
        .into_iter()
        .map(|phase| AircCommand {
            transport: CommandTransport::Airc,
            room: config.preferred_room.clone(),
            persona: config.preferred_persona.clone(),
            phase,
            command: phase.as_command().to_owned(),
            payload: PhaseContext {
                variant_id: package.variant_id.clone(),
                role_family: dossier.role_family.clone(),
                company: dossier.company.clone(),
                summary: summary.clone(),
                approval_checkpoints: approval_policy.checkpoints.clone(),
                responsibilities: responsibilities.clone(),
            },
            capabilities: phase_capabilities(phase),
            human_approval_required: matches!(
                phase,
                ContinuumPhase::RequestApproval | ContinuumPhase::Submit
            ) && approval_policy.require_human_approval,
        })
        .collect::<Vec<_>>();

    ContinuumRecipe {
        schema_version: SCHEMA_VERSION.to_owned(),
        variant_id: package.variant_id.clone(),
        persona: config.preferred_persona.clone(),
        room: config.preferred_room.clone(),
        commands,
    }
}

pub fn create_submission_record(
    package: &ApplicationPackage,
    approval_policy: &ApprovalPolicy,
) -> SubmissionRecord {
    SubmissionRecord {
        schema_version: SCHEMA_VERSION.to_owned(),
        variant_id: package.variant_id.clone(),
        company: package.company.clone(),
        role_family: package.role_family.clone(),
        status: if approval_policy.require_human_approval {
            SubmissionStatus::AwaitingApproval
        } else {
            SubmissionStatus::Submitted
        },
        approvals: approval_policy
            .checkpoints
            .iter()
            .map(|checkpoint| ApprovalDecision {
                checkpoint: checkpoint.clone(),
                actor: approval_policy
                    .approvers
                    .first()
                    .cloned()
                    .unwrap_or_else(|| "candidate".to_owned()),
                approved: false,
            })
            .collect(),
        feedback: None,
        rejection_reason: None,
    }
}

pub fn capture_outcome(
    record: &SubmissionRecord,
    status: SubmissionStatus,
    feedback: Option<String>,
    rejection_reason: Option<String>,
) -> SubmissionRecord {
    let mut updated = record.clone();
    updated.status = status;
    updated.feedback = feedback;
    updated.rejection_reason = rejection_reason;
    if matches!(
        status,
        SubmissionStatus::Submitted | SubmissionStatus::Callback | SubmissionStatus::Interview
    ) {
        updated.approvals = updated
            .approvals
            .into_iter()
            .map(|decision| ApprovalDecision {
                approved: true,
                ..decision
            })
            .collect();
    }
    updated
}

pub fn run_pipeline(
    config: &ForkConfig,
    sources: &UserSourceBundle,
    dossier: &JobDossier,
    track: &str,
) -> PipelineOutputs {
    let normalized = normalize_user_sources(config, sources);
    let variant_id = build_variant_id(config, dossier, track);
    let ranked_evidence = build_ranked_evidence(&normalized, dossier, config, variant_id.clone());
    let package =
        generate_application_package(&normalized, dossier, &ranked_evidence, variant_id.clone());
    let continuum_recipe =
        create_continuum_recipe(config, dossier, &package, &normalized.approval_policy);
    let submission_record = create_submission_record(&package, &normalized.approval_policy);

    PipelineOutputs {
        schema_version: SCHEMA_VERSION.to_owned(),
        stages: vec![
            PipelineStage {
                stage: PipelineStageKind::SourceIngestion,
                description: "Normalize fork-provided source data into shared Rust types."
                    .to_owned(),
            },
            PipelineStage {
                stage: PipelineStageKind::EvidenceShaping,
                description: "Rank compact evidence packs for a target job dossier.".to_owned(),
            },
            PipelineStage {
                stage: PipelineStageKind::ApplicationGeneration,
                description: "Generate versioned materials and Continuum/AIRC phase commands."
                    .to_owned(),
            },
            PipelineStage {
                stage: PipelineStageKind::OutcomeCapture,
                description: "Prepare submission and analytics records for later feedback capture."
                    .to_owned(),
            },
        ],
        execution_boundary: ExecutionBoundary {
            schema_version: SCHEMA_VERSION.to_owned(),
            project_is_source_of_truth: true,
            continuum_recipe_required: true,
            notes: vec![
                "The Rust project code is the authoritative implementation.".to_owned(),
                "The Continuum/AIRC recipe coordinates persona-driven execution for this repo."
                    .to_owned(),
                "A non-agentic project could reuse the same engine without Continuum phases."
                    .to_owned(),
            ],
        },
        normalized_portfolio: normalized,
        ranked_evidence,
        application_package: package,
        continuum_recipe,
        submission_record,
    }
}

fn compact_phrase(input: &str) -> String {
    input
        .split_terminator(['.', '!', '?'])
        .next()
        .unwrap_or(input)
        .trim()
        .to_owned()
}

fn unique_strings(items: Vec<String>) -> Vec<String> {
    let mut unique = Vec::<String>::new();
    for item in items {
        let trimmed = item.trim();
        if !trimmed.is_empty() && !unique.iter().any(|existing| existing == trimmed) {
            unique.push(trimmed.to_owned());
        }
    }
    unique
}

fn merge_unique(left: &[String], right: &[String]) -> Vec<String> {
    let mut merged = left.to_vec();
    for item in right {
        if !merged.contains(item) {
            merged.push(item.clone());
        }
    }
    merged
}

fn lowercased(items: &[String]) -> Vec<String> {
    items.iter().map(|item| item.to_lowercase()).collect()
}

fn slugify(input: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            slug.push('-');
            last_was_dash = true;
        }
    }
    slug.trim_matches('-').to_owned()
}

fn phase_capabilities(phase: ContinuumPhase) -> Vec<String> {
    match phase {
        ContinuumPhase::FindOpportunities => vec!["persona", "job-search"],
        ContinuumPhase::EnrichOpportunity => vec!["persona", "job-research"],
        ContinuumPhase::GenerateMaterials => {
            vec!["persona", "resume-generation", "cover-letter-generation"]
        }
        ContinuumPhase::RequestApproval => vec!["persona", "human-approval"],
        ContinuumPhase::Submit => vec!["persona", "playwright", "captcha", "form-submission"],
        ContinuumPhase::ReportOutcome => vec!["persona", "crm-update"],
        ContinuumPhase::AnalyzeExperiments => vec!["persona", "analytics"],
    }
    .into_iter()
    .map(str::to_owned)
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> ForkConfig {
        ForkConfig {
            schema_version: SCHEMA_VERSION.to_owned(),
            user_id: "joel".to_owned(),
            source_root: "user-sources/joel".to_owned(),
            preferred_persona: "qwen-27b-career".to_owned(),
            preferred_room: "#career".to_owned(),
            scoring_weights: ScoringWeights {
                skill_match_weight: 3,
                domain_match_weight: 2,
                evidence_bonus_weight: 1,
            },
            job_search_scope: vec!["ai engineer".to_owned(), "platform".to_owned()],
            voice_constraints: vec!["direct".to_owned(), "grounded".to_owned()],
            experimentation_rules: vec!["stable variant ids".to_owned()],
            output_template: "default".to_owned(),
        }
    }

    fn sample_sources() -> UserSourceBundle {
        UserSourceBundle {
            schema_version: SCHEMA_VERSION.to_owned(),
            identity_profile: IdentityProfile {
                full_name: "Joel Teply".to_owned(),
                headline: "Builder of learning systems".to_owned(),
                summary: "I build applied AI systems with real-world feedback loops.".to_owned(),
                location: Some("Chicago".to_owned()),
            },
            work_history: vec![WorkHistoryItem {
                company: "CambrianTech".to_owned(),
                role: "Founder".to_owned(),
                summary: "Built agent systems, analytics loops, and deployment workflows.".to_owned(),
                skills: vec!["Rust".to_owned(), "Analytics".to_owned()],
                domain_tags: vec!["AI".to_owned(), "Automation".to_owned()],
            }],
            projects: vec![ProjectSource {
                title: "Career wrangler".to_owned(),
                summary: "Reusable career workflow recipe engine.".to_owned(),
                repository: Some("CambrianTech/career-wrangler".to_owned()),
                skills: vec!["Rust".to_owned(), "AIRC".to_owned()],
                domain_tags: vec!["Automation".to_owned(), "Recruiting".to_owned()],
            }],
            github_evidence: vec![GithubEvidence {
                repository: "CambrianTech/continuum".to_owned(),
                title: "Continuum orchestration".to_owned(),
                summary: "Directed persistent personas and command flows.".to_owned(),
                skills: vec!["Continuum".to_owned(), "TypeScript".to_owned()],
                domain_tags: vec!["AI".to_owned(), "Agents".to_owned()],
                url: Some("https://github.com/CambrianTech/continuum".to_owned()),
            }],
            skill_tags: vec![
                SkillTag {
                    skill: "Rust".to_owned(),
                    domains: vec!["Systems".to_owned()],
                },
                SkillTag {
                    skill: "Continuum".to_owned(),
                    domains: vec!["Agents".to_owned()],
                },
            ],
            voice_examples: vec![VoiceExample {
                job_family: "ai-platform".to_owned(),
                exemplar: "I build systems that keep learning after launch. I care about grounded evidence.".to_owned(),
            }],
            target_preferences: TargetPreferences {
                preferred_roles: vec!["Staff AI Engineer".to_owned()],
                preferred_companies: vec!["Example Co".to_owned()],
                preferred_locations: vec!["Remote".to_owned()],
                keywords: vec!["agents".to_owned(), "rust".to_owned()],
            },
            prior_applications: vec![PriorApplicationRecord {
                company: "Old Co".to_owned(),
                role: "Principal Engineer".to_owned(),
                role_family: "platform".to_owned(),
                variant_id: "joel-platform-old-co-a".to_owned(),
                status: OutcomeStatus::Rejected,
                notes: Some("Needed more backend depth called out.".to_owned()),
                rejection_reason: Some("resume too generic".to_owned()),
            }],
            approval_policy: ApprovalPolicy {
                approvers: vec!["joel".to_owned()],
                checkpoints: vec!["materials".to_owned(), "submission".to_owned()],
                require_human_approval: true,
            },
        }
    }

    fn sample_dossier() -> JobDossier {
        JobDossier {
            schema_version: SCHEMA_VERSION.to_owned(),
            company: "Example Co".to_owned(),
            title: "Staff AI Engineer".to_owned(),
            role_family: "ai-platform".to_owned(),
            hiring_team: Some("Example hiring team".to_owned()),
            skills: vec![
                "Rust".to_owned(),
                "Continuum".to_owned(),
                "Analytics".to_owned(),
            ],
            domain_tags: vec!["AI".to_owned(), "Automation".to_owned()],
            responsibilities: vec!["ship agents".to_owned(), "improve callbacks".to_owned()],
            application_questions: vec![ApplicationQuestion {
                prompt: "Why are you a fit for this role?".to_owned(),
            }],
        }
    }

    #[test]
    fn normalizes_fork_provided_sources_into_shared_portfolio_types() {
        let normalized = normalize_user_sources(&sample_config(), &sample_sources());

        assert_eq!(normalized.schema_version, SCHEMA_VERSION);
        assert_eq!(normalized.user_id, "joel");
        assert_eq!(normalized.portfolio.artifacts.len(), 4);
        assert_eq!(
            normalized.approval_policy.checkpoints,
            vec!["materials", "submission"]
        );
        assert!(
            normalized
                .voice_profile
                .preferred_phrase
                .as_deref()
                .unwrap()
                .contains("I build systems that keep learning after launch")
        );
    }

    #[test]
    fn ranks_compact_evidence_packs_for_a_job_dossier() {
        let config = sample_config();
        let normalized = normalize_user_sources(&config, &sample_sources());
        let dossier = sample_dossier();
        let evidence = build_ranked_evidence(&normalized, &dossier, &config, "variant-a");

        assert_eq!(evidence.schema_version, SCHEMA_VERSION);
        assert_eq!(evidence.role_family, "ai-platform");
        assert!(!evidence.ranked_artifacts.is_empty());
        assert!(evidence.ranked_artifacts[0].score >= evidence.ranked_artifacts[1].score);
        assert!(!evidence.evidence_packs.is_empty());
    }

    #[test]
    fn pipeline_outputs_are_versioned_and_emit_named_continuum_phases() {
        let config = sample_config();
        let outputs = run_pipeline(&config, &sample_sources(), &sample_dossier(), "control");

        assert_eq!(outputs.schema_version, SCHEMA_VERSION);
        assert_eq!(outputs.stages.len(), 4);
        assert!(outputs.execution_boundary.project_is_source_of_truth);
        assert!(outputs.execution_boundary.continuum_recipe_required);
        assert_eq!(
            outputs.application_package.variant_id,
            "joel-ai-platform-example-co-control"
        );
        assert_eq!(outputs.continuum_recipe.commands.len(), 7);
        assert_eq!(
            outputs.continuum_recipe.commands[0].phase,
            ContinuumPhase::FindOpportunities
        );
        assert_eq!(
            outputs.continuum_recipe.commands[4].capabilities,
            vec!["persona", "playwright", "captcha", "form-submission"]
        );
    }

    #[test]
    fn outcome_capture_and_analytics_track_variant_company_and_role_family() {
        let config = sample_config();
        let outputs = run_pipeline(&config, &sample_sources(), &sample_dossier(), "control");
        let submitted = capture_outcome(
            &outputs.submission_record,
            SubmissionStatus::Interview,
            Some("Strong technical screen.".to_owned()),
            None,
        );

        let mut repository = InMemoryApplicationRepository::default();
        repository.save_package(outputs.application_package.clone());
        repository.save_submission(submitted.clone());
        {
            let mut analytics = ApplicationAnalytics::new(&mut repository);
            analytics.record_outcome(
                submitted.variant_id.clone(),
                submitted.company.clone(),
                submitted.role_family.clone(),
                OutcomeStatus::Interview,
            );
            analytics.record_outcome(
                submitted.variant_id.clone(),
                submitted.company.clone(),
                submitted.role_family.clone(),
                OutcomeStatus::Rejected,
            );
        }

        let analytics = ApplicationAnalytics::new(&mut repository).summarize();
        assert_eq!(submitted.status, SubmissionStatus::Interview);
        assert!(submitted.approvals.iter().all(|decision| decision.approved));
        assert_eq!(analytics.len(), 1);
        assert_eq!(
            analytics[0].variant_id,
            "joel-ai-platform-example-co-control"
        );
        assert_eq!(analytics[0].callbacks, 1);
        assert_eq!(analytics[0].interviews, 1);
        assert_eq!(analytics[0].rejections, 1);
    }
}
