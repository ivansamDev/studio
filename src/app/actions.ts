
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

  console.log("fetchAndFormat action called. FormData:", {url: rawUrl, processingOption: rawProcessingOption});


  const validationResult = UrlInputSchema.safeParse({ 
    url: rawUrl, 
    processingOption: rawProcessingOption 
  });

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("Validation failed:", errorMessages);
    return {
      markdown: null,
      error: errorMessages,
      success: false,
    };
  }

  const { url: validatedUrl, processingOption: validatedProcessingOption } = validationResult.data;
  console.log("Validation successful. Processing with:", { validatedUrl, validatedProcessingOption });

  try {
    if (validatedProcessingOption === 'external_api') {
      const externalApiUrl = process.env.EXTERNAL_MARKDOWN_API_URL;
      if (!externalApiUrl) {
        console.error("External API URL not configured.");
        throw new Error("External API URL is not configured. Please set EXTERNAL_MARKDOWN_API_URL environment variable.");
      }

      console.log(`Using external API: ${externalApiUrl} for URL: ${validatedUrl}`);
      const apiResponse = await fetch(externalApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: validatedUrl }),
      });

      if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        console.error(`External API request failed: ${apiResponse.status} ${apiResponse.statusText}. Details: ${errorBody}`);
        throw new Error(`External API request failed: ${apiResponse.status} ${apiResponse.statusText}. Details: ${errorBody}`);
      }

      const responseText = await apiResponse.text();
      let markdownContent: string;

      try {
        const result = JSON.parse(responseText);
        if (result.error) {
          console.error(`External API returned an error in JSON: ${result.error}`);
          throw new Error(`External API returned an error: ${result.error}`);
        }
        if (typeof result.markdown === 'string') {
          markdownContent = result.markdown;
          console.log("External API returned JSON with markdown content.");
        } else {
          console.warn("External API JSON response did not include valid markdown content. Treating response as plain text.");
          markdownContent = responseText; // Fallback if 'markdown' key is not a string
        }
      } catch (jsonError) {
        // If JSON.parse fails, assume the responseText is plain markdown
        console.log("External API response is not valid JSON. Treating as plain text markdown.", jsonError);
        markdownContent = responseText;
      }
      
      if (typeof markdownContent !== 'string' || markdownContent.trim() === "") {
        console.error("External API response did not result in valid non-empty markdown content.");
        throw new Error("External API response did not provide valid markdown content.");
      }
      
      console.log("Successfully received markdown from external API.");
      return { 
        markdown: markdownContent, 
        error: null, 
        success: true, 
        submittedUrl: validatedUrl,
        submittedProcessingOption: validatedProcessingOption 
      };

    } else {
      // Existing local AI processing logic
      console.log("Using local AI processing for URL:", validatedUrl);
      const response = await fetch(validatedUrl, {
        headers: {
          'User-Agent': 'MarkdownFetcher/1.0', 
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch URL locally: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }
      
      const fullHtmlContent = await response.text();

      if (fullHtmlContent.length > 5 * 1024 * 1024) { 
        console.error("Content too large to process (max 5MB).");
        throw new Error("Content too large to process (max 5MB).");
      }
      if (fullHtmlContent.trim() === "") {
        console.error("Fetched content is empty.");
        throw new Error("Fetched content is empty.");
      }

      let contentForAI: string;

      switch (validatedProcessingOption) {
        case 'extract_body_strip_tags':
          const bodyContent = extractBodyContent(fullHtmlContent);
          contentForAI = stripHtmlTags(bodyContent);
          console.log("Local AI: Extracted body and stripped tags.");
          break;
        case 'full_page_strip_tags':
          contentForAI = stripHtmlTags(fullHtmlContent);
          console.log("Local AI: Stripped tags from full page.");
          break;
        case 'full_page_ai_handles_html':
          contentForAI = fullHtmlContent; 
          console.log("Local AI: Sending full page HTML to AI.");
          break;
        default:
          console.error("Invalid local processing option encountered:", validatedProcessingOption);
          throw new Error("Invalid local processing option.");
      }
      
      if (contentForAI.trim() === "" && validatedProcessingOption !== 'full_page_ai_handles_html') {
        console.warn(`Content became empty after local processing option: ${validatedProcessingOption}. This might indicate an HTML-only page or an issue with content structure.`);
      }
      
      const formatInput: FormatURLToMarkdownInput = { 
        url: validatedUrl, 
        content: contentForAI,
        processingOption: validatedProcessingOption 
      };
      console.log("Sending content to local AI for formatting.");
      const result = await formatURLToMarkdown(formatInput);
      console.log("Successfully received markdown from local AI.");
      
      return { 
        markdown: result.markdown, 
        error: null, 
        success: true, 
        submittedUrl: validatedUrl,
        submittedProcessingOption: validatedProcessingOption 
      };
    }

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

