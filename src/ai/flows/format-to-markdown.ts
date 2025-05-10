'use server';
/**
 * @fileOverview A flow to format content fetched from a URL into Markdown.
 *
 * - formatURLToMarkdown - A function that formats content from a URL into Markdown.
 * - FormatURLToMarkdownInput - The input type for the formatURLToMarkdown function.
 * - FormatURLToMarkdownOutput - The return type for the formatURLToMarkdown function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ProcessingOptionsEnum } from '@/lib/schemas/processing-options'; // Import the enum

// ProcessingOption type is now also in processing-options.ts but not directly needed here if FormatURLToMarkdownInputSchema uses the imported enum

const FormatURLToMarkdownInputSchema = z.object({
  url: z.string().describe('The URL content was fetched from.'),
  processingOption: ProcessingOptionsEnum.describe('The method used to process the content before sending to the AI.'),
  content: z.string().describe(
    "The content fetched from the URL. If processingOption is 'full_page_ai_handles_html', this is raw HTML. Otherwise, it's pre-processed text after stripping HTML tags."
  ),
});
export type FormatURLToMarkdownInput = z.infer<typeof FormatURLToMarkdownInputSchema>;

const FormatURLToMarkdownOutputSchema = z.object({
  markdown: z.string().describe('The formatted Markdown content.'),
});
export type FormatURLToMarkdownOutput = z.infer<typeof FormatURLToMarkdownOutputSchema>;

export async function formatURLToMarkdown(input: FormatURLToMarkdownInput): Promise<FormatURLToMarkdownOutput> {
  return formatURLToMarkdownFlow(input);
}

const prompt = ai.definePrompt({
  name: 'formatURLToMarkdownPrompt',
  input: {schema: FormatURLToMarkdownInputSchema},
  output: {schema: FormatURLToMarkdownOutputSchema},
  prompt: `You are an expert in converting web content into clean, readable Markdown.
The content below was fetched from the URL: {{{url}}}.
The original content was processed using the '{{{processingOption}}}' method before being provided to you.

- If '{{{processingOption}}}' is 'extract_body_strip_tags': The content is text extracted from the HTML body tag, with all HTML tags subsequently removed.
- If '{{{processingOption}}}' is 'full_page_strip_tags': The content is text from the entire HTML page, with all HTML tags subsequently removed.
- If '{{{processingOption}}}' is 'full_page_ai_handles_html': The content is the raw HTML of the entire page. Your task is to parse this HTML, identify and extract the main textual content (e.g., article, blog post), and convert it into well-structured Markdown. You should try to exclude common boilerplate like navigation menus, sidebars, headers, footers, ads, and script/style tags.

Based on the '{{{processingOption}}}' and the provided content, please generate clean, well-structured Markdown.

Content:
{{{content}}}
`,
});

const formatURLToMarkdownFlow = ai.defineFlow(
  {
    name: 'formatURLToMarkdownFlow',
    inputSchema: FormatURLToMarkdownInputSchema,
    outputSchema: FormatURLToMarkdownOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
