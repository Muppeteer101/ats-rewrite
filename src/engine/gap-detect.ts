const STOPWORDS = new Set([
  'and', 'or', 'the', 'for', 'with', 'that', 'this', 'from', 'into', 'will',
  'able', 'have', 'been', 'your', 'their', 'any', 'all', 'can', 'has', 'are',
  'was', 'its', 'our', 'you', 'they', 'when', 'than', 'more', 'also', 'such',
  'must', 'role', 'team', 'work', 'skills', 'experience', 'ability',
]);

function significantWords(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
}

/**
 * Returns required JD skills that are NOT evidenced in the CV.
 *
 * Uses word-level matching: a skill is "covered" if ANY of its significant
 * keywords (len ≥ 5, non-stopword) appear in the combined CV text +
 * stated_skills + implied_skills corpus. This avoids false-positives from
 * exact-phrase matching against JD phrases the CV would never contain verbatim.
 */
export function detectGaps(
  jdRequiredSkills: string[],
  cvText: string,
  cvAnalysis: { stated_skills: string[]; implied_skills: string[] },
): string[] {
  const corpus = [
    cvText,
    cvAnalysis.stated_skills.join(' '),
    cvAnalysis.implied_skills.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  return jdRequiredSkills.filter((skill) => {
    const words = significantWords(skill);
    if (words.length === 0) return false; // unparseable — don't flag
    return !words.some((w) => corpus.includes(w));
  });
}
