
'use server';

import { formatURLToMarkdown, type FormatURLToMarkdownInput } from '@/ai/flows/format-to-markdown';
import { ProcessingOptionsEnum, type ProcessingOption } from '@/lib/schemas/processing-options'; // Updated import
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
    text = text.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'), `\n$&`);
    text = text.replace(new RegExp(`</${tag}>`, 'gi'), '$&\n');
  });
  text = text.replace(/<br\s*\/?>/gi, '\n');
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
  
  // 5. Normalize whitespace
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

    if (fullHtmlContent.length > 5 * 1024 * 1024) { // 5MB limit
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
        contentForAI = fullHtmlContent; // Send raw HTML to AI
        break;
      default:
        // Should not happen due to schema validation
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
