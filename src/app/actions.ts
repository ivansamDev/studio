
'use server';

import { formatURLToMarkdown, type FormatURLToMarkdownInput } from '@/ai/flows/format-to-markdown';
import { chatWithMarkdown, type ChatWithMarkdownInput } from '@/ai/flows/chat-with-markdown-flow';
import { ProcessingOptionsEnum, type ProcessingOption } from '@/lib/schemas/processing-options'; 
import { z } from 'zod';

const UrlInputSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }),
  processingOption: ProcessingOptionsEnum,
});

export interface FetchAndFormatState {
  markdown: string | null;
  error: string | null;
  success: boolean;
  submittedUrl?: string;
  submittedProcessingOption?: ProcessingOption;
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    console.log("Successfully extracted content from <body> tag.");
    return bodyMatch[1].trim();
  }
  console.warn("Could not find <body> tag or it was empty. Using full HTML content for processing.");
  return html;
}

function stripHtmlTags(html: string): string {
  let text = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  text = text.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
  const blockTags = [
    'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 
    'td', 'th', 'tr', 'caption', 'section', 'article', 'aside', 'nav', 
    'header', 'footer', 'address', 'dd', 'dt', 'dl', 'figure', 'figcaption'
  ];
  blockTags.forEach(tag => {
    text = text.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'), `\n$&`);
    text = text.replace(new RegExp(`</${tag}>`, 'gi'), '$&\n');
  });
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&copy;/g, '©');
  text = text.replace(/&reg;/g, '®');
  text = text.replace(/ +/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();
  return text;
}


export async function fetchAndFormat(
  prevState: FetchAndFormatState,
  formData: FormData
): Promise<FetchAndFormatState> {
  const rawUrl = formData.get('url');
  const rawProcessingOption = formData.get('processingOption') as ProcessingOption;

  const validationResult = UrlInputSchema.safeParse({ 
    url: rawUrl, 
    processingOption: rawProcessingOption 
  });

  if (!validationResult.success) {
    return {
      markdown: null,
      error: validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
      success: false,
    };
  }

  const { url: validatedUrl, processingOption: validatedProcessingOption } = validationResult.data;

  try {
    const response = await fetch(validatedUrl, {
      headers: {
        'User-Agent': 'MarkdownFetcher/1.0', 
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const fullHtmlContent = await response.text();

    if (fullHtmlContent.length > 5 * 1024 * 1024) { 
      throw new Error("Content too large to process (max 5MB).");
    }
    if (fullHtmlContent.trim() === "") {
      throw new Error("Fetched content is empty.");
    }

    let contentForAI: string;

    switch (validatedProcessingOption) {
      case 'extract_body_strip_tags':
        const bodyContent = extractBodyContent(fullHtmlContent);
        contentForAI = stripHtmlTags(bodyContent);
        break;
      case 'full_page_strip_tags':
        contentForAI = stripHtmlTags(fullHtmlContent);
        break;
      case 'full_page_ai_handles_html':
        contentForAI = fullHtmlContent; 
        break;
      default:
        throw new Error("Invalid processing option.");
    }
    
    if (contentForAI.trim() === "" && validatedProcessingOption !== 'full_page_ai_handles_html') {
      console.warn(`Content became empty after processing option: ${validatedProcessingOption}. This might indicate an HTML-only page or an issue with content structure.`);
    }
    
    const formatInput: FormatURLToMarkdownInput = { 
      url: validatedUrl, 
      content: contentForAI,
      processingOption: validatedProcessingOption
    };
    const result = await formatURLToMarkdown(formatInput);
    
    return { 
      markdown: result.markdown, 
      error: null, 
      success: true, 
      submittedUrl: validatedUrl,
      submittedProcessingOption: validatedProcessingOption 
    };

  } catch (error: any) {
    console.error("Error in fetchAndFormat action:", error);
    let errorMessage = "An unexpected error occurred while processing the URL.";
    if (error.message) {
      errorMessage = error.message;
    }
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('EAI_AGAIN')) {
        errorMessage = "Could not connect to the URL. Please check the URL and your internet connection.";
    }
    return { 
      markdown: null, 
      error: errorMessage, 
      success: false, 
      submittedUrl: validatedUrl,
      submittedProcessingOption: validatedProcessingOption
    };
  }
}

export interface ChatAgentState {
  agentResponse: string | null;
  error: string | null;
}

export async function callChatAgentAction(input: {
  userQuery: string;
  markdownContent: string | null;
  chatHistory: ChatWithMarkdownInput['chatHistory'];
}): Promise<ChatAgentState> {
  try {
    const result = await chatWithMarkdown({
      userQuery: input.userQuery,
      markdownContent: input.markdownContent ?? undefined,
      chatHistory: input.chatHistory,
    });
    return { agentResponse: result.agentResponse, error: null };
  } catch (error: any) {
    console.error("Error in callChatAgentAction:", error);
    let errorMessage = "Failed to get response from agent.";
    if (error.message) {
        // Attempt to extract a more specific message if Genkit/API provides one
        if (typeof error.message === 'string' && error.message.includes('reason: ')) {
            errorMessage = error.message.split('reason: ')[1];
        } else if (typeof error.message === 'string') {
            errorMessage = error.message;
        }
    }
    return { agentResponse: null, error: errorMessage };
  }
}
