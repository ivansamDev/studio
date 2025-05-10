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

- If '{{{processingOption}}}' is 'extract_body_strip_tags': The content is text extracted from the HTML body tag, with all HTML tags subsequently removed. Your task is to analyze this plain text, infer its structure, and convert it into well-structured Markdown. This includes:
    - Correctly identifying and formatting paragraphs with appropriate line breaks.
    - Detecting and formatting lists (bulleted or numbered).
    - Recognizing potential headings (e.g., based on capitalization, context, or line breaks in the input) and formatting them using Markdown heading syntax (e.g., #, ##).
    - Preserving or formatting pre-formatted text or code blocks if discernible (e.g., using fenced code blocks).
    - Ensuring the output is valid, standard Markdown.
- If '{{{processingOption}}}' is 'full_page_strip_tags': Similar to the above, but the content is text from the entire HTML page with tags removed. Apply the same principles of inferring structure from plain text and converting to well-structured Markdown. This includes ensuring appropriate paragraph separation, list formatting, and heading detection.
- If '{{{processingOption}}}' is 'full_page_ai_handles_html': The content is the raw HTML of the entire page. Your task is to parse this HTML, identify and extract the main textual content (e.g., article, blog post), and convert it into well-structured, valid Markdown. You should:
    - Convert HTML tags like <p>, <h1>-<h6>, <ul>, <ol>, <li>, <blockquote>, <pre>, <code>, <a>, <img>, <strong>, <em>, etc., to their Markdown equivalents (e.g., <p> to paragraph, <h1> to # Heading, <ul> to * list item).
    - Attempt to exclude common boilerplate content such as navigation menus, sidebars, headers, footers, advertisements, and script/style tags unless they contain primary content.
    - Ensure all HTML entities (e.g., &nbsp;, &lt;, &gt;, &amp;) are correctly handled or converted to their standard character representations or Markdown equivalents.
    - Pay attention to nested structures and preserve them in Markdown where appropriate (e.g., nested lists).

Regardless of the processing option, the final output MUST be clean, valid, and readable Markdown.
Focus on semantic conversion and readability. Avoid including any explanatory text or apologies in your response; return only the Markdown.

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

