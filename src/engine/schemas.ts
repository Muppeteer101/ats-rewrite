import { z } from 'zod';

/**
 * Six-pass engine output schemas. Each pass's JSON is validated by Zod after
 * extraction from the LLM response, so a malformed pass fails fast with a
 * clear error instead of silently populating the UI with undefined.
 *
 * Naming convention: camelCase throughout — this is what the UI and the
 * prompts use, so we don't translate between the two.
 */

/* ────────────────────── Pass 1 — Job Analysis ────────────────────── */

export const SENIORITY_LEVELS = [
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
  'director',
  'executive',
] as const;

export const jobAnalysisSchema = z.object({
  /** Promoted to a top-level field so downstream code (PDF filename,
   *  email subject, dashboard list) doesn't need to reach into roleOverview. */
  roleTitle: z.string(),
  seniorityLevel: z.string(),

  roleOverview: z.object({
    jobTitle: z.string(),
    seniorityLevel: z.string(),
    industry: z.string(),
    sector: z.string(),
    companyType: z.string(),
  }),
  mustHaves: z.object({
    hardSkills: z.array(z.string()),
    qualifications: z.array(z.string()),
    experience: z.string(),
    nonNegotiables: z.array(z.string()),
  }),
  niceToHaves: z.object({
    skills: z.array(z.string()),
    qualifications: z.array(z.string()),
    additionalExperience: z.array(z.string()),
  }),
  languageAndTone: z.object({
    keyPhrases: z.array(z.string()),
    tone: z.string(),
    jargon: z.array(z.string()),
  }),
  whatTheyReallyWant: z.object({
    personDescription: z.string(),
    cultureSignals: z.string(),
  }),
  rejectionRisks: z.array(z.string()),
});
export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

/* ────────────────────── Pass 2 — CV Analysis ────────────────────── */

export const cvAnalysisSchema = z.object({
  candidateOverview: z.object({
    currentRole: z.string(),
    seniorityLevel: z.string(),
    industryBackground: z.string(),
    careerTrajectory: z.string(),
    yearsOfExperience: z.string(),
  }),
  strengths: z.object({
    hardSkills: z.array(z.string()),
    quantifiedAchievements: z.array(z.string()),
    standoutExperience: z.array(z.string()),
    qualifications: z.array(z.string()),
  }),
  weaknesses: z.object({
    thinOrAbsentAreas: z.array(z.string()),
    vagueAchievements: z.array(z.string()),
    careerGaps: z.array(z.string()),
    missingQualifications: z.array(z.string()),
  }),
  presentationQuality: z.object({
    structure: z.string(),
    formattingRisks: z.array(z.string()),
    languageQuality: z.string(),
    lengthAssessment: z.string(),
  }),
  recruiterFirstImpression: z.object({
    positive: z.string(),
    negative: z.string(),
    likelyStopPoint: z.string(),
  }),
});
export type CVAnalysis = z.infer<typeof cvAnalysisSchema>;

/* ────────────────────── Pass 3 — Role Match Score ────────────────────── */

const categoryScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string(),
});

export const roleMatchSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string(),
  categoryScores: z.object({
    mustHaveSkills: categoryScoreSchema,
    niceToHaveSkills: categoryScoreSchema,
    seniorityAndExperience: categoryScoreSchema,
    industryRelevance: categoryScoreSchema,
    languageAlignment: categoryScoreSchema,
  }),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  honestAssessment: z.string(),
  pilePosition: z.enum(['top', 'middle', 'bottom']),
});
export type RoleMatch = z.infer<typeof roleMatchSchema>;

/* ────────────────────── Pass 4 — Recruiter Verdict ────────────────────── */

export const recruiterVerdictSchema = z.object({
  decision: z.enum(['YES', 'MAYBE', 'NO']),
  oneSentenceReason: z.string(),
  inFavour: z.array(z.string()),
  against: z.array(z.string()),
  whatWouldChangeIt: z.array(z.string()),
  disclaimer: z.string(),
});
export type RecruiterVerdict = z.infer<typeof recruiterVerdictSchema>;

/* ────────────────────── Pass 5 — Rewrite + Cover Letter + Changes ────────────────────── */

/**
 * The rewritten CV in structured form so the PDF templates can render it.
 * No before/after/reason per bullet — the "Changes Made" list is separate.
 */
export const rewriteOutputSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).optional(),
  }),
  /** Professional summary tailored to the target role. Plain prose. */
  summary: z.string(),
  /** Work history in reverse-chronological order. Each bullet is final prose. */
  roles: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  /** Skills list ordered by relevance to the JD. */
  skills: z.array(z.string()),
  education: z
    .array(
      z.object({
        institution: z.string(),
        qualification: z.string(),
        dates: z.string().optional(),
      }),
    )
    .optional(),
  certifications: z.array(z.string()).optional(),
});
export type RewriteOutput = z.infer<typeof rewriteOutputSchema>;

export const coverLetterSchema = z.object({
  greeting: z.string(),
  paragraphs: z.array(z.string()).min(2).max(5),
  signoff: z.string(),
  signature: z.string(),
});
export type CoverLetter = z.infer<typeof coverLetterSchema>;

/**
 * Combined output of Pass 5 — one LLM call produces all three artefacts
 * so the rewrite, cover letter, and change log share a single coherent
 * view of the candidate + role.
 */
export const rewritePass5Schema = z.object({
  rewrittenCV: rewriteOutputSchema,
  coverLetter: coverLetterSchema,
  changesMade: z.array(z.string()),
});
export type RewritePass5 = z.infer<typeof rewritePass5Schema>;

/* ────────────────────── Pass 6 — ATS Confidence ────────────────────── */

export const atsConfidenceSchema = z.object({
  rating: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  percentage: z.number().min(0).max(100),
  summary: z.string(),
  scoring: z.object({
    keywordMatch: categoryScoreSchema,
    keywordDensity: categoryScoreSchema,
    sectionStructure: categoryScoreSchema,
    formattingCompatibility: categoryScoreSchema,
    fileFormatReadiness: categoryScoreSchema,
    seniorityAlignment: categoryScoreSchema,
  }),
  whatsWorking: z.array(z.string()),
  remainingRisks: z.array(z.string()),
  finalStatement: z.string(),
});
export type ATSConfidence = z.infer<typeof atsConfidenceSchema>;

/* ────────────────────── Final engine result ────────────────────── */

export type EngineResult = {
  id: string;
  createdAt: number;
  jobSource: { kind: 'text' | 'pdf' | 'docx' | 'url'; url?: string };
  cvSource: { kind: 'text' | 'pdf' | 'docx' };

  jobAnalysis: JobAnalysis;
  cvAnalysis: CVAnalysis;
  roleMatch: RoleMatch;
  recruiterVerdict: RecruiterVerdict;
  rewrite: RewriteOutput;
  coverLetter: CoverLetter;
  changesMade: string[];
  atsConfidence: ATSConfidence;
  /** Gaps the user confirmed they DO have (integrated into the rewrite). */
  confirmedGaps?: string[];
  /** ATS score on the original pre-rewrite CV — for the "before" number. */
  atsOriginal?: ATSConfidence;
};

/* ────────────────────── SSE narration events ────────────────────── */

export type PassNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type NarrationTone = 'good' | 'amber' | 'bad' | 'info';

/** Thin teaser — ONLY scores + gap labels. No reasoning, never. */
export type Teaser = {
  matchScore: number;
  verdictDecision: 'YES' | 'MAYBE' | 'NO';
  atsRating: 'HIGH' | 'MEDIUM' | 'LOW';
  atsPercentage: number;
  gaps: string[];
  jobTitle: string;
};

export type NarrationEvent =
  | { type: 'system'; line: string }
  | { type: 'pass'; pass: PassNumber; line: string }
  | { type: 'pass-complete'; pass: PassNumber; line: string; tone?: NarrationTone }
  | { type: 'warn'; line: string }
  | { type: 'teaser'; data: Teaser }
  | { type: 'result'; id: string }
  | { type: 'error'; message: string };
