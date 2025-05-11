
"use client";

import type {NextPage} from 'next';
import { useEffect, useActionState, startTransition, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LinkIcon, Loader2, ClipboardCopy, Check, AlertCircle, MessageSquare, Save, Trash2, Brain, Replace } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from '@/components/app-header';
import { fetchAndFormat, type FetchAndFormatState, callChatAgentAction, type ChatAgentState } from './actions';
import type { ChatWithMarkdownInput } from '@/ai/flows/chat-with-markdown-flow';
import { 
  ProcessingOptionsEnum, 
  LocalAiProcessingDetailOptionsEnum,
  type ProcessingOption,
  type LocalAiProcessingDetailOption
} from '@/lib/schemas/processing-options';
import { FloatingChat } from '@/components/floating-chat';
import { SavedItem, SavedItemSchema } from '@/lib/schemas/saved-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL (e.g., https://example.com)." }),
  processingMethod: z.enum(['local_ai', 'external_api']).default('local_ai'),
  localAiProcessingDetail: LocalAiProcessingDetailOptionsEnum.default('extract_body_strip_tags'),
}).superRefine((data, ctx) => {
  if (data.processingMethod === 'local_ai' && !data.localAiProcessingDetail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please select a content handling detail for Local AI processing.",
      path: ["localAiProcessingDetail"],
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

const initialFetchState: FetchAndFormatState = {
  markdown: null,
  error: null,
  success: false,
  submittedUrl: undefined,
  submittedProcessingOption: undefined,
};


interface SubmitButtonProps {
  pending: boolean;
}

function SubmitButton({ pending }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending} className="w-full py-3 text-base">
      {pending ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <LinkIcon className="mr-2 h-5 w-5" />
      )}
      {pending ? 'Fetching & Formatting...' : 'Fetch & Format'}
    </Button>
  );
}

const processingMethodOptions: { value: 'local_ai' | 'external_api'; label: string; description: string }[] = [
  {
    value: 'local_ai',
    label: 'Process with Local AI',
    description: 'Use a local AI model to fetch, parse, and format content to Markdown.'
  },
  {
    value: 'external_api',
    label: 'Process with External API',
    description: 'Delegate fetching, parsing, and Markdown conversion to a configured external API.'
  }
];

const localAiDetailOptionsConfig: { value: LocalAiProcessingDetailOption; label: string; description: string }[] = [
  { 
    value: 'extract_body_strip_tags', 
    label: 'Extract Body & Strip HTML',
    description: 'Extracts content from <body>, removes HTML, then AI formats to Markdown. Good for articles.' 
  },
  { 
    value: 'full_page_strip_tags', 
    label: 'Full Page & Strip HTML',
    description: 'Takes entire page, removes HTML, then AI formats to Markdown.'
  },
  { 
    value: 'full_page_ai_handles_html', 
    label: 'Full Page - AI Parses HTML',
    description: 'Sends raw HTML to AI to parse and format. Slower, good for complex pages.'
  }
];

const MarkdownFetcherPage: NextPage = () => {
  const [fetchState, formAction, isFetchPending] = useActionState(fetchAndFormat, initialFetchState);
  const [isCopied, setIsCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [displayedMarkdown, setDisplayedMarkdown] = useState<string | null>(null);
  const [displayedUrl, setDisplayedUrl] = useState<string | undefined>(undefined);
  const [activeContentSource, setActiveContentSource] = useState<'fetch' | 'saved'>('fetch');


  const { toast } = useToast();

  const form = useForm<FormValues>({ 
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      processingMethod: "local_ai",
      localAiProcessingDetail: "extract_body_strip_tags",
    },
  });

  const watchedProcessingMethod = form.watch('processingMethod');

 useEffect(() => {
    if (fetchState.success && fetchState.markdown) {
      setDisplayedMarkdown(fetchState.markdown);
      setDisplayedUrl(fetchState.submittedUrl);
      setActiveContentSource('fetch');
      setShowChat(true); 
      setTimeout(() => { 
        chatContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    } else if (!fetchState.success && fetchState.error) {
      // Do not hide chat if there's an error, user might want to discuss the error
      // setShowChat(false); 
    }

    const currentFormValues = form.getValues();
    let currentEffectiveProcessingOption: ProcessingOption | undefined;
    if (currentFormValues.processingMethod === 'external_api') {
      currentEffectiveProcessingOption = 'external_api';
    } else if (currentFormValues.localAiProcessingDetail) {
      currentEffectiveProcessingOption = currentFormValues.localAiProcessingDetail;
    }
    
    if (fetchState.error) {
      if (fetchState.submittedUrl === currentFormValues.url && fetchState.submittedProcessingOption === currentEffectiveProcessingOption) {
        const errorMessage = fetchState.error.includes(': ') ? fetchState.error.split(': ').slice(1).join(': ') : fetchState.error;
        form.setError("url", { type: "manual", message: errorMessage });
      }
    } else if (fetchState.submittedUrl === currentFormValues.url && fetchState.submittedProcessingOption === currentEffectiveProcessingOption) {
        form.clearErrors("url");
    }
  }, [fetchState, form]);

  const handleCopyToClipboard = async () => {
    const contentToCopy = activeContentSource === 'saved' ? displayedMarkdown : fetchState.markdown;
    if (contentToCopy) {
      try {
        await navigator.clipboard.writeText(contentToCopy);
        setIsCopied(true);
        toast({
          title: "Success!",
          description: "Markdown copied to clipboard.",
        });
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to copy Markdown.",
        });
        console.error('Failed to copy text: ', err);
      }
    }
  };
  
  const onSubmit = (data: FormValues) => {
    console.log("Form submitted with data:", data);
    let finalProcessingOption: ProcessingOption;

    if (data.processingMethod === 'external_api') {
      finalProcessingOption = 'external_api';
    } else {
      finalProcessingOption = data.localAiProcessingDetail!; 
    }

    if (fetchState.error && (fetchState.submittedUrl !== data.url || fetchState.submittedProcessingOption !== finalProcessingOption)) {
        form.clearErrors("url");
    }
    // Reset displayed markdown from saved item if a new fetch is initiated
    if (activeContentSource === 'saved') {
        setDisplayedMarkdown(null);
        setDisplayedUrl(undefined);
        setActiveContentSource('fetch');
    }

    const formData = new FormData();
    formData.append('url', data.url);
    formData.append('processingOption', finalProcessingOption);
    
    startTransition(() => {
      formAction(formData);
    });
  };

  const handleSaveItem = () => {
    const markdownToSave = activeContentSource === 'saved' ? displayedMarkdown : fetchState.markdown;
    const urlToSave = activeContentSource === 'saved' ? displayedUrl : fetchState.submittedUrl;

    if (markdownToSave && urlToSave) {
      const newItem: SavedItem = {
        id: Date.now().toString(),
        url: urlToSave,
        markdownContent: markdownToSave,
        title: urlToSave.length > 50 ? `${urlToSave.substring(0, 47)}...` : urlToSave,
        savedAt: new Date(),
      };
      setSavedItems(prevItems => [newItem, ...prevItems]); // Add to the beginning of the list
      toast({
        title: "Item Saved",
        description: `Content from ${newItem.title} saved for analysis.`,
      });
    } else {
       toast({
        variant: "destructive",
        title: "Cannot Save",
        description: "No Markdown content available to save.",
      });
    }
  };

  const handleRemoveSavedItem = (itemId: string) => {
    setSavedItems(prevItems => prevItems.filter(item => item.id !== itemId));
    toast({
      title: "Item Removed",
      description: "Saved item has been removed from the list.",
    });
  };

  const handleReplaceMarkdownWithSaved = (item: SavedItem) => {
    setDisplayedMarkdown(item.markdownContent);
    setDisplayedUrl(item.url);
    setActiveContentSource('saved');
    form.setValue('url', item.url); // Update the URL in the form for consistency
    
    // Clear any fetch-related errors from the form as we are now displaying saved content
    form.clearErrors("url");
    
    // If chat is not open, open it
    if (!showChat) {
      setShowChat(true);
    }
     setTimeout(() => { 
        chatContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);

    toast({
      title: "Content Loaded",
      description: `Displaying saved content from ${item.title}. Chat is now aware of this content.`,
    });
  };

  const currentMarkdownToDisplay = activeContentSource === 'saved' ? displayedMarkdown : fetchState.markdown;
  const currentUrlForDisplay = activeContentSource === 'saved' ? displayedUrl : fetchState.submittedUrl;
  const displayError = activeContentSource === 'fetch' && fetchState.error && !fetchState.success && 
                       fetchState.submittedUrl === form.getValues("url") && 
                       fetchState.submittedProcessingOption === (form.getValues("processingMethod") === 'external_api' ? 'external_api' : form.getValues("localAiProcessingDetail"));


  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 bg-background text-foreground">
      <AppHeader />
      
      <div className="flex flex-col md:flex-row md:space-x-6 w-full max-w-7xl flex-grow">
        {/* Column 1: Form Card & Saved Items */}
        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col space-y-6 mb-6 md:mb-0">
          <Card className="shadow-xl rounded-lg flex flex-col flex-grow">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Fetch Web Content</CardTitle>
              <CardDescription>Enter a URL and choose how to process it.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Website URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com" 
                            {...field} 
                            className="py-3 text-base bg-card border-input focus:ring-primary focus:border-primary" 
                            aria-describedby="url-error"
                          />
                        </FormControl>
                        <FormMessage id="url-error" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="processingMethod"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm font-medium">Processing Method</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value: 'local_ai' | 'external_api') => {
                              field.onChange(value);
                              if (value === 'local_ai' && !form.getValues('localAiProcessingDetail')) {
                                form.setValue('localAiProcessingDetail', 'extract_body_strip_tags', { shouldValidate: true });
                              }
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-2"
                          >
                            {processingMethodOptions.map((option) => (
                              <FormItem key={option.value} className="flex items-start space-x-3 space-y-0 p-3 border rounded-md bg-card hover:bg-secondary/20 transition-colors">
                                <FormControl>
                                  <RadioGroupItem value={option.value} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="font-normal cursor-pointer">
                                    {option.label}
                                  </FormLabel>
                                  <p className="text-xs text-muted-foreground">{option.description}</p>
                                </div>
                              </FormItem>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedProcessingMethod === 'local_ai' && (
                    <FormField
                      control={form.control}
                      name="localAiProcessingDetail"
                      render={({ field }) => (
                        <FormItem className="space-y-3 pt-2 border-t mt-4">
                          <FormLabel className="text-sm font-medium pt-4 block">Local AI - Content Handling</FormLabel>
                           <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value} 
                              className="flex flex-col space-y-2"
                            >
                              {localAiDetailOptionsConfig.map((option) => (
                                <FormItem key={option.value} className="flex items-start space-x-3 space-y-0 p-3 border rounded-md bg-card hover:bg-secondary/20 transition-colors">
                                  <FormControl>
                                    <RadioGroupItem value={option.value} />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="font-normal cursor-pointer">
                                      {option.label}
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground">{option.description}</p>
                                  </div>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <SubmitButton pending={isFetchPending} />
                </form>
              </Form>
            </CardContent>
          </Card>

          {savedItems.length > 0 && (
            <Card className="shadow-xl rounded-lg flex flex-col">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Saved Items for Analysis</CardTitle>
                <CardDescription>These items can be analyzed by the AI chat agent.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[200px] pr-3">
                  <ul className="space-y-2">
                    {savedItems.map(item => (
                      <li key={item.id} className="p-3 border rounded-md bg-card flex items-center justify-between">
                        <div className="flex-grow overflow-hidden mr-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm font-medium truncate text-foreground">{item.title}</p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{item.url}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <p className="text-xs text-muted-foreground">
                            Saved: {item.savedAt.toLocaleDateString()} {item.savedAt.toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                           <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                 <Button variant="ghost" size="icon" onClick={() => handleReplaceMarkdownWithSaved(item)} className="text-muted-foreground hover:text-primary">
                                  <Replace className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Use this content (replaces current fetch)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveSavedItem(item.id)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove this item</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Column 2: Markdown Display & Error Alert */}
        <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col flex-grow">
          {isFetchPending ? (
            <Card className="w-full shadow-xl rounded-lg flex flex-col flex-grow items-center justify-center p-6 animate-in fade-in-0 duration-300 min-h-[300px] md:min-h-0 h-full">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-lg text-foreground">Processing URL...</p>
              <p className="text-sm text-muted-foreground">Please wait while we fetch and format the content.</p>
            </Card>
          ) : displayError ? (
            <div className="h-full flex flex-col">
              <Alert variant="destructive" className="w-full shadow-lg rounded-lg mb-6 animate-in fade-in-0 duration-300">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>Error Processing URL</AlertTitle>
                <AlertDescription>{fetchState.error}</AlertDescription>
              </Alert>
               <Card className="w-full shadow-xl rounded-lg flex flex-col flex-grow items-center justify-center p-6 text-muted-foreground min-h-[300px] md:min-h-0 h-full">
                <LinkIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg">Formatted content will appear here</p>
                <p className="text-sm">Enter a URL and click "Fetch & Format" to begin.</p>
              </Card>
            </div>
          ) : currentMarkdownToDisplay ? (
            <Card className="w-full shadow-xl rounded-lg flex flex-col flex-grow animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-out h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-grow">
                  <CardTitle className="text-2xl font-semibold">Formatted Markdown</CardTitle>
                  {currentUrlForDisplay && (
                    <CardDescription className="text-xs truncate">
                      Source: {currentUrlForDisplay} ({activeContentSource === 'saved' ? 'Saved Item' : 'Fetched'})
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                   <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleSaveItem} aria-label="Save Markdown for analysis">
                          <Save className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Save for later analysis</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleCopyToClipboard} aria-label="Copy Markdown to clipboard">
                          {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <ClipboardCopy className="h-5 w-5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy to clipboard</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-grow flex flex-col">
                <Textarea
                  readOnly
                  value={currentMarkdownToDisplay}
                  className="flex-grow min-h-[300px] font-mono text-sm resize-y bg-card border-input focus:ring-primary focus:border-primary p-3 rounded-md"
                  aria-label="Formatted Markdown content"
                  data-ai-hint="markdown text"
                />
              </CardContent>
            </Card>
          ) : (
             <Card className="w-full shadow-xl rounded-lg flex flex-col flex-grow items-center justify-center p-6 text-muted-foreground min-h-[300px] md:min-h-0 h-full">
              <LinkIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg">Formatted content will appear here</p>
              <p className="text-sm">Enter a URL and click "Fetch & Format" to begin.</p>
            </Card>
          )}
        </div>
      </div>
      
      <div ref={chatContainerRef}>
        {showChat && (
            <FloatingChat 
                markdownContent={currentMarkdownToDisplay} 
                sourceUrl={currentUrlForDisplay}
                savedItemsForAnalysis={savedItems}
                activeContentSource={activeContentSource}
                key={activeContentSource === 'saved' ? displayedUrl : fetchState.submittedUrl} // Force re-mount on source change
            />
        )}
      </div>
    </div>
  );
};

export default MarkdownFetcherPage;
