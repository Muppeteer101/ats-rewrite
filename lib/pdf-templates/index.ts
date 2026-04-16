import type { EngineResult } from '@/src/engine/schemas';
import { renderAtsClean } from './atsClean';
import { renderProfessional } from './professional';
import { renderModern } from './modern';

export type TemplateId = 'ats-clean' | 'professional' | 'modern';

export const TEMPLATES: ReadonlyArray<{
  id: TemplateId;
  label: string;
  description: string;
  recommended?: boolean;
  atsRisk: 'minimal' | 'low' | 'moderate';
}> = [
  {
    id: 'ats-clean',
    label: 'ATS-clean',
    description: 'Single column, plain section labels, Helvetica. Maximises ATS pass rate. Recommended for online applications.',
    recommended: true,
    atsRisk: 'minimal',
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Single column with subtle accent typography. Same parse rate as ATS-clean — slightly more "designed" feel.',
    atsRisk: 'low',
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Left sidebar for contact + skills + education. Visually distinctive — best for direct sends (LinkedIn DM, intro email). May reduce ATS pass rate on older parsers.',
    atsRisk: 'moderate',
  },
];

export function renderTemplate(id: TemplateId, result: EngineResult): string {
  switch (id) {
    case 'ats-clean':
      return renderAtsClean(result);
    case 'professional':
      return renderProfessional(result);
    case 'modern':
      return renderModern(result);
    default:
      // Fallback to the safest option if an unknown id slips through.
      return renderAtsClean(result);
  }
}
