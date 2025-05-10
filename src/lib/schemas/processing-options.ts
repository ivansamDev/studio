
import { z } from 'zod';

export const ProcessingOptionsEnum = z.enum([
  'extract_body_strip_tags',
  'full_page_strip_tags',
  'full_page_ai_handles_html',
  'external_api',
]);
export type ProcessingOption = z.infer<typeof ProcessingOptionsEnum>;

export const LocalAiProcessingDetailOptionsEnum = z.enum([
  'extract_body_strip_tags',
  'full_page_strip_tags',
  'full_page_ai_handles_html',
]);
export type LocalAiProcessingDetailOption = z.infer<typeof LocalAiProcessingDetailOptionsEnum>;
