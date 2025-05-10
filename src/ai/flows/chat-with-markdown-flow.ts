
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
  prompt: `You are an AI assistant.
Your primary task is to answer questions based ONLY on the provided Markdown content below, if the question is relevant to it.
You MUST respond in the same language as the user's query.

{{#if markdownContent}}
The user is viewing the following Markdown content:
<markdown_content>
{{{markdownContent}}}
</markdown_content>
If the user's query "{{{userQuery}}}" is related to this content, your answer MUST be based SOLELY on this information. Do not use external knowledge for questions about this content.
If the query is clearly unrelated to the Markdown content, or if the content does not provide an answer to a related question, you should state that the content does not cover the topic. You may then use your general knowledge to answer if appropriate, but clearly indicate that the information is not from the provided Markdown.
{{else}}
No specific Markdown content has been provided. Answer the user's questions generally. If they ask about specific content, inform them that no content has been fetched yet.
{{/if}}

Respond to the user's query: "{{{userQuery}}}"
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

