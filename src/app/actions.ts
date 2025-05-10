
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
        'User-Agent': 'MarkdownFetcher/1.0', // Some sites block default fetch user agents
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    // Allow common text-based content types
    if (contentType && !/text\/html|text\/plain|application\/json|application\/xml|application\/rss\+xml/.test(contentType)) {
      console.warn(`Fetching content type ${contentType}, which might not be ideal for Markdown conversion. Proceeding anyway.`);
    }
    
    const textContent = await response.text();

    // Basic content size check to prevent overload (e.g., 1MB)
    if (textContent.length > 1024 * 1024) { 
      throw new Error("Content too large to process (max 1MB).");
    }
    if (textContent.trim() === "") {
      throw new Error("Fetched content is empty.");
    }

    const formatInput: FormatURLToMarkdownInput = { url: validatedUrl, content: textContent };
    const result = await formatURLToMarkdown(formatInput);
    
    return { markdown: result.markdown, error: null, success: true, submittedUrl: validatedUrl };

  } catch (error: any) {
    console.error("Error in fetchAndFormat action:", error);
    let errorMessage = "An unexpected error occurred while processing the URL.";
    if (error.message) {
      errorMessage = error.message;
    }
    // Avoid leaking too much internal detail for common errors
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('EAI_AGAIN')) {
        errorMessage = "Could not connect to the URL. Please check the URL and your internet connection.";
    }
    return { markdown: null, error: errorMessage, success: false, submittedUrl: validatedUrl };
  }
}
