
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

function stripHtmlTags(html: string): string {
  // 1. Remove script and style blocks and their content
  let text = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  text = text.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');

  // 2. Replace block-level tags with newlines to preserve some structure
  const blockTags = [
    'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 
    'td', 'th', 'tr', 'caption', 'section', 'article', 'aside', 'nav', 
    'header', 'footer', 'address', 'dd', 'dt', 'dl', 'figure', 'figcaption'
  ];
  blockTags.forEach(tag => {
    // Add newline before opening tag and after closing tag to separate blocks
    text = text.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'), `\n$&`);
    text = text.replace(new RegExp(`</${tag}>`, 'gi'), '$&\n');
  });
  // Handle <br> tags specifically by converting them to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Handle <hr> tags by converting them to a thematic break in Markdown
  text = text.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // 3. Remove all remaining HTML tags (leaves their content)
  text = text.replace(/<[^>]+>/g, '');

  // 4. Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&copy;/g, '©');
  text = text.replace(/&reg;/g, '®');
  // Add more entities as needed or rely on LLM for more complex ones.

  // 5. Normalize whitespace:
  // Replace multiple spaces (not newlines yet) with a single space
  text = text.replace(/ +/g, ' ');
  // Collapse multiple newlines down to a maximum of two (to preserve paragraph breaks)
  text = text.replace(/\n\s*\n/g, '\n\n');
  // Remove leading/trailing whitespace (including newlines) from the final text
  text = text.trim();

  return text;
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
    
    const textContent = await response.text();

    if (textContent.length > 5 * 1024 * 1024) { // Increased limit to 5MB
      throw new Error("Content too large to process (max 5MB).");
    }
    if (textContent.trim() === "") {
      throw new Error("Fetched content is empty.");
    }

    let contentToProcess = textContent;
    const contentType = response.headers.get('content-type');

    if (contentType && /text\/html/.test(contentType)) {
      const extractedBody = extractBodyContent(textContent);
      // Use extracted body if it's meaningful and different from the full HTML
      if (extractedBody !== textContent && extractedBody.trim() !== "") {
        console.log("Using extracted body content for HTML stripping.");
        contentToProcess = extractedBody;
      } else {
        // Body not found, empty, or not significantly different from full HTML.
        // Log appropriate message but continue to process full textContent.
        if (extractedBody.trim() === "" && textContent.trim() !== "") {
            console.warn("Extracted body content was empty, but original HTML was not. Stripping tags from full HTML.");
        } else {
            console.log("Body content not extracted or same as full HTML. Stripping tags from full HTML content.");
        }
        // contentToProcess remains textContent
      }
    } else if (contentType) {
      console.warn(`Content type is ${contentType}, not text/html. Attempting to strip any HTML tags found.`);
    } else {
      console.warn(`Content type not specified. Attempting to strip any HTML tags found.`);
    }
    
    const finalStrippedContent = stripHtmlTags(contentToProcess);

    if (finalStrippedContent.trim() === "") {
      // This could happen if the HTML contained only tags and no actual text content
      console.warn("Content became empty after stripping HTML tags. This might indicate an HTML-only page or an issue with content structure.");
      // Depending on desired behavior, could throw an error or return specific message.
      // For now, we'll proceed, and the AI might return an empty markdown or a note.
    }

    const formatInput: FormatURLToMarkdownInput = { url: validatedUrl, content: finalStrippedContent };
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
