
'use server';

import { formatURLToMarkdown, type FormatURLToMarkdownInput } from '@/ai/flows/format-to-markdown';
import { z } from 'zod';

const UrlInputSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }),
});

export interface FetchAndFormatState {
  markdown: string | null;
  error: string | null;
  success: boolean;
  submittedUrl?: string;
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    console.log("Successfully extracted content from <body> tag.");
    return bodyMatch[1].trim();
  }
  console.warn("Could not find <body> tag or it was empty. Using full HTML content for Markdown conversion.");
  return html;
}

export async function fetchAndFormat(
  prevState: FetchAndFormatState,
  formData: FormData
): Promise<FetchAndFormatState> {
  const rawUrl = formData.get('url');

  const validationResult = UrlInputSchema.safeParse({ url: rawUrl });

  if (!validationResult.success) {
    return {
      markdown: null,
      error: validationResult.error.errors.map((e) => e.message).join(', '),
      success: false,
    };
  }

  const validatedUrl = validationResult.data.url;

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

    const contentType = response.headers.get('content-type');
    if (contentType && !/text\/html/.test(contentType)) {
       // If not HTML, we probably don't want to extract body and can proceed as before for other types
      console.warn(`Content type is ${contentType}, not text/html. Processing full content.`);
    }
    
    const textContent = await response.text();

    if (textContent.length > 5 * 1024 * 1024) { // Increased limit to 5MB
      throw new Error("Content too large to process (max 5MB).");
    }
    if (textContent.trim() === "") {
      throw new Error("Fetched content is empty.");
    }

    let contentToFormat = textContent;
    if (contentType && /text\/html/.test(contentType)) {
      contentToFormat = extractBodyContent(textContent);
      if (contentToFormat.trim() === "") {
        // If body extraction results in empty content, but original content was not empty
        console.warn("Extracted body content is empty. Falling back to full text content for Markdown conversion.");
        contentToFormat = textContent; // Fallback to full content if body is empty
      }
    }


    const formatInput: FormatURLToMarkdownInput = { url: validatedUrl, content: contentToFormat };
    const result = await formatURLToMarkdown(formatInput);
    
    return { markdown: result.markdown, error: null, success: true, submittedUrl: validatedUrl };

  } catch (error: any) {
    console.error("Error in fetchAndFormat action:", error);
    let errorMessage = "An unexpected error occurred while processing the URL.";
    if (error.message) {
      errorMessage = error.message;
    }
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('EAI_AGAIN')) {
        errorMessage = "Could not connect to the URL. Please check the URL and your internet connection.";
    }
    return { markdown: null, error: errorMessage, success: false, submittedUrl: validatedUrl };
  }
}

