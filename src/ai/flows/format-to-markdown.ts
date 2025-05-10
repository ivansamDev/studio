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

const FormatURLToMarkdownInputSchema = z.object({
  url: z.string().describe('The URL to fetch content from.'),
  content: z.string().describe('The content fetched from the URL.'),
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
  prompt: `You are an expert in formatting content into Markdown.

  Please format the following content into Markdown:

  Content: {{{content}}} `,
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
