
'use server';
/**
 * @fileOverview A Genkit flow for a chat agent that can discuss provided Markdown content or engage in general conversation.
 *
 * - chatWithMarkdown - A function to interact with the chat agent.
 * - ChatWithMarkdownInput - The input type for the chatWithMarkdown function.
 * - ChatWithMarkdownOutput - The return type for the chatWithMarkdown function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type {MessageData} from 'genkit/vite'; // For chatHistory type

const ChatHistoryItemSchema = z.object({
  role: z.enum(['user', 'model']),
  parts: z.array(z.object({text: z.string()})),
});

const ChatWithMarkdownInputSchema = z.object({
  markdownContent: z
    .string()
    .optional()
    .describe('The Markdown content fetched from a URL, if available.'),
  userQuery: z.string().describe("The user's current message or question."),
  chatHistory: z
    .array(ChatHistoryItemSchema)
    .optional()
    .describe('The conversation history.'),
});
export type ChatWithMarkdownInput = z.infer<typeof ChatWithMarkdownInputSchema>;

const ChatWithMarkdownOutputSchema = z.object({
  agentResponse: z.string().describe("The AI agent's response to the user query."),
});
export type ChatWithMarkdownOutput = z.infer<typeof ChatWithMarkdownOutputSchema>;

export async function chatWithMarkdown(
  input: ChatWithMarkdownInput
): Promise<ChatWithMarkdownOutput> {
  return chatWithMarkdownFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'chatWithMarkdownPrompt',
  input: {schema: ChatWithMarkdownInputSchema},
  output: {schema: ChatWithMarkdownOutputSchema},
  prompt: `You are a helpful AI assistant.
{{#if markdownContent}}
The user is currently viewing the following Markdown content. Use this as the primary context if their questions seem relevant to it.
<markdown_content>
{{{markdownContent}}}
</markdown_content>
{{else}}
The user has not provided any specific content. Answer their questions generally. If they ask about content, inform them that no content has been fetched yet.
{{/if}}

Based on the provided context (if any) and the conversation history, respond to the user's latest query: "{{{userQuery}}}"
`,
});

const chatWithMarkdownFlow = ai.defineFlow(
  {
    name: 'chatWithMarkdownFlow',
    inputSchema: ChatWithMarkdownInputSchema,
    outputSchema: ChatWithMarkdownOutputSchema,
  },
  async (input: ChatWithMarkdownInput) => {
    const {output} = await chatPrompt(input, {
      history: input.chatHistory as MessageData[] | undefined, // Cast to MessageData for Genkit
    });
    return output!;
  }
);

