import { z } from 'zod';

/* ────────────────────── Pass 1 — JD analysis ────────────────────── */

export const jdAnalysisSchema = z.object({
  role_title: z.string(),
  seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive']),
  required_skills: z.array(z.string()),
  preferred_skills: z.array(z.string()),
  domain_keywords: z.array(z.string()),
  soft_signals: z.array(z.string()),
  deal_breakers: z.array(z.string()),
  seniority_signals: z.array(z.string()),
  company_tone: z.enum(['formal', 'startup-casual', 'academic', 'corporate', 'mixed']),
});
export type JDAnalysis = z.infer<typeof jdAnalysisSchema>;

/* ────────────────────── Pass 2 — CV analysis ────────────────────── */

export const cvAchievementSchema = z.object({
  text: z.string(),
  has_metric: z.boolean(),
});

export const cvRoleSchema = z.object({
  title: z.string(),
  company: z.string(),
  dates: z.string(),
  responsibilities: z.array(z.string()),
  achievements: z.array(cvAchievementSchema),
});

export const cvAnalysisSchema = z.object({
  candidate_seniority: z.enum(['intern', 'junior', 'mid', 'senior', 'lead', 'principal', 'executive']),
  years_experience: z.number(),
  contact: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).optional(),
  }),
  summary: z.string().optional(),
  roles: z.array(cvRoleSchema),
  stated_skills: z.array(z.string()),
  implied_skills: z.array(z.string()),
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
  voice_signature: z.object({
    formality: z.number().min(0).max(10),
    verbosity: z.number().min(0).max(10),
    first_person: z.boolean(),
  }),
});
export type CVAnalysis = z.infer<typeof cvAnalysisSchema>;

/* ────────────── Pass 3 — Rewrite + change-log ────────────── */

export const rewriteBulletSchema = z.object({
  before: z.string(),
  after: z.string(),
  reason: z.string(),
});

export const rewriteRoleSchema = z.object({
  title: z.string(),
  company: z.string(),
  dates: z.string(),
  bullets: z.array(rewriteBulletSchema),
});

export const rewriteOutputSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).optional(),
  }),
  summary: z.object({
    before: z.string(),
    after: z.string(),
    reason: z.string(),
  }),
  roles: z.array(rewriteRoleSchema),
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
  /** Honest list of JD-required skills the CV does NOT have (no fabrication). */
  unmet_requirements: z.array(z.string()),
});
export type RewriteOutput = z.infer<typeof rewriteOutputSchema>;

/* ────────────────────── Pass 4 — ATS scoring ────────────────────── */

export const atsScoreSchema = z.object({
  before_score: z.number().min(0).max(100),
  after_score: z.number().min(0).max(100),
  keyword_coverage: z.object({
    required: z.string(), // e.g. "11/12"
    preferred: z.string(),
  }),
  matched_keywords: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  strengthened_areas: z.array(z.string()),
  honest_gap_report: z.string(),
  format_warnings: z.array(z.string()).optional(),
});
export type ATSScore = z.infer<typeof atsScoreSchema>;

/* ────────────────────── Pass 5 — Cover letter ─────────────────── */

export const coverLetterSchema = z.object({
  /** Greeting line — "Dear Hiring Manager," or "Dear [Name]," if a contact is named in the JD. */
  greeting: z.string(),
  /** 3–4 short paragraphs. No corporate filler, no AI tells, no fabrication. */
  paragraphs: z.array(z.string()).min(2).max(5),
  /** Sign-off line — "Best regards," / "Kind regards," — matches CV voice formality. */
  signoff: z.string(),
  /** Candidate name as in the CV. */
  signature: z.string(),
});
export type CoverLetter = z.infer<typeof coverLetterSchema>;

/* ────────────────────── Final engine result ────────────────────── */

export type EngineResult = {
  id: string;
  jdAnalysis: JDAnalysis;
  cvAnalysis: CVAnalysis;
  rewrite: RewriteOutput;
  score: ATSScore;
  coverLetter: CoverLetter;
  createdAt: number;
  jdSource: { kind: 'text' | 'pdf' | 'docx' | 'url'; url?: string };
  cvSource: { kind: 'text' | 'pdf' | 'docx' };
};

/* ────────────────────── SSE narration events ────────────────────── */

export type NarrationEvent =
  | { type: 'system'; line: string }
  | { type: 'pass'; pass: 1 | 2 | 3 | 4; line: string }
  | { type: 'pass-complete'; pass: 1 | 2 | 3 | 4; line: string }
  | { type: 'warn'; line: string }
  | { type: 'result'; id: string }
  | { type: 'error'; message: string };
