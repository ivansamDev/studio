
"use client";

import type {NextPage} from 'next';
import { useEffect, useActionState, startTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LinkIcon, Loader2, ClipboardCopy, Check, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from '@/components/app-header';
import { fetchAndFormat, type FetchAndFormatState } from './actions';
import { ProcessingOptionsEnum, type ProcessingOption } from '@/lib/schemas/processing-options';
import { FloatingChat } from '@/components/floating-chat';


const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL (e.g., https://example.com)." }),
  processingOption: ProcessingOptionsEnum.default('extract_body_strip_tags'),
});

type FormValues = z.infer<typeof formSchema>;

const initialState: FetchAndFormatState = {
  markdown: null,
  error: null,
  success: false,
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

const processingOptionsConfig: { value: ProcessingOption; label: string; description: string }[] = [
  { 
    value: 'extract_body_strip_tags', 
    label: 'Extract Body & Strip HTML (Local AI)',
    description: 'Extracts content from <body>, removes HTML, then local AI formats to Markdown. Good for articles.' 
  },
  { 
    value: 'full_page_strip_tags', 
    label: 'Full Page & Strip HTML (Local AI)',
    description: 'Takes entire page, removes HTML, then local AI formats to Markdown.'
  },
  { 
    value: 'full_page_ai_handles_html', 
    label: 'Full Page - Local AI Parses HTML',
    description: 'Sends raw HTML to local AI to parse and format. Slower, good for complex pages.'
  },
  {
    value: 'external_api',
    label: 'External API Handles Fetch & Format',
    description: 'Delegates fetching URL content and Markdown conversion to a configured external API.'
  }
];

const MarkdownFetcherPage: NextPage = () => {
  const [state, formAction, isPending] = useActionState(fetchAndFormat, initialState);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({ 
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      processingOption: "extract_body_strip_tags",
    },
  });

 useEffect(() => {
    if (state.success && state.markdown) {
      // Optionally, scroll to results or give other feedback
    }
    const currentFormValues = form.getValues();
    if (state.error) {
      // Only set form error if the error corresponds to the current form input values
      if (state.submittedUrl === currentFormValues.url && state.submittedProcessingOption === currentFormValues.processingOption) {
        // Attempt to extract a more user-friendly part of the error, or use the full error
        const errorMessage = state.error.includes(': ') ? state.error.split(': ').slice(1).join(': ') : state.error;
        form.setError("url", { type: "manual", message: errorMessage });
      }
    } else if (state.submittedUrl === currentFormValues.url && state.submittedProcessingOption === currentFormValues.processingOption) {
        // Clear errors if submission was successful for current values
        form.clearErrors("url");
    }
  }, [state, form]);

  const handleCopyToClipboard = async () => {
    if (state.markdown) {
      try {
        await navigator.clipboard.writeText(state.markdown);
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
     // Clear previous errors manually before new submission if they are for a different URL/option
    if (state.error && (state.submittedUrl !== data.url || state.submittedProcessingOption !== data.processingOption)) {
        form.clearErrors("url");
    }
    const formData = new FormData();
    formData.append('url', data.url);
    formData.append('processingOption', data.processingOption);
    
    startTransition(() => {
      formAction(formData);
    });
  };


  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 bg-background text-foreground">
      <AppHeader />

      <Card className="w-full max-w-2xl shadow-xl rounded-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Enter URL & Options</CardTitle>
          <CardDescription>Paste a web address and choose how to process its content.</CardDescription>
        </CardHeader>
        <CardContent>
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
                        className="py-3 text-base bg-secondary/50 border-border focus:ring-primary focus:border-primary" 
                        aria-describedby="url-error"
                      />
                    </FormControl>
                    <FormMessage id="url-error" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="processingOption"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-sm font-medium">Processing Option</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-2"
                      >
                        {processingOptionsConfig.map((option) => (
                          <FormItem key={option.value} className="flex items-start space-x-3 space-y-0 p-3 border rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors">
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
              <SubmitButton pending={isPending} />
            </form>
          </Form>
        </CardContent>
      </Card>

      {state.error && !state.success && state.submittedUrl === form.getValues("url") && state.submittedProcessingOption === form.getValues("processingOption") && (
        <Alert variant="destructive" className="mt-6 w-full max-w-2xl shadow-lg rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error Processing URL</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.success && state.markdown && (
        <Card className="mt-6 w-full max-w-2xl shadow-xl rounded-lg animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-out">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl font-semibold">Formatted Markdown</CardTitle>
            <Button variant="ghost" size="icon" onClick={handleCopyToClipboard} aria-label="Copy Markdown to clipboard">
              {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <ClipboardCopy className="h-5 w-5" />}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              value={state.markdown}
              className="h-96 min-h-[200px] font-mono text-sm resize-y bg-secondary/30 border-border focus:ring-primary focus:border-primary p-3 rounded-md"
              aria-label="Formatted Markdown content"
              data-ai-hint="markdown text"
            />
          </CardContent>
        </Card>
      )}
      <FloatingChat markdownContent={state.markdown} />
    </div>
  );
};

export default MarkdownFetcherPage;


    
