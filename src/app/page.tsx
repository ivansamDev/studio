
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
import { 
  ProcessingOptionsEnum, 
  LocalAiProcessingDetailOptionsEnum,
  type ProcessingOption,
  type LocalAiProcessingDetailOption
} from '@/lib/schemas/processing-options';
import { FloatingChat } from '@/components/floating-chat';


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
  const [state, formAction, isPending] = useActionState(fetchAndFormat, initialState);
  const [isCopied, setIsCopied] = useState(false);
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
    if (state.success && state.markdown) {
      // Optionally, scroll to results or give other feedback
    }
    const currentFormValues = form.getValues();
    let currentEffectiveProcessingOption: ProcessingOption | undefined;
    if (currentFormValues.processingMethod === 'external_api') {
      currentEffectiveProcessingOption = 'external_api';
    } else if (currentFormValues.localAiProcessingDetail) {
      currentEffectiveProcessingOption = currentFormValues.localAiProcessingDetail;
    }
    
    if (state.error) {
      if (state.submittedUrl === currentFormValues.url && state.submittedProcessingOption === currentEffectiveProcessingOption) {
        const errorMessage = state.error.includes(': ') ? state.error.split(': ').slice(1).join(': ') : state.error;
        form.setError("url", { type: "manual", message: errorMessage });
      }
    } else if (state.submittedUrl === currentFormValues.url && state.submittedProcessingOption === currentEffectiveProcessingOption) {
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
    console.log("Form submitted with data:", data); // Debugging line
    let finalProcessingOption: ProcessingOption;

    if (data.processingMethod === 'external_api') {
      finalProcessingOption = 'external_api';
    } else {
      // localAiProcessingDetail is guaranteed by schema default and refine
      finalProcessingOption = data.localAiProcessingDetail!; 
    }

    // Clear previous errors manually before new submission if they are for a different URL/option
    if (state.error && (state.submittedUrl !== data.url || state.submittedProcessingOption !== finalProcessingOption)) {
        form.clearErrors("url");
    }

    const formData = new FormData();
    formData.append('url', data.url);
    formData.append('processingOption', finalProcessingOption);
    
    startTransition(() => {
      formAction(formData);
    });
  };


  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 bg-background text-foreground">
      <AppHeader />

      <Card className="w-full max-w-2xl shadow-xl rounded-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Fetch Web Content as Markdown</CardTitle>
          <CardDescription>Enter a URL, choose how to process it, and get clean Markdown.</CardDescription>
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

              {watchedProcessingMethod === 'local_ai' && (
                <FormField
                  control={form.control}
                  name="localAiProcessingDetail"
                  render={({ field }) => (
                    <FormItem className="space-y-3 pt-2 border-t mt-6">
                      <FormLabel className="text-sm font-medium pt-4 block">Local AI - Content Handling Detail</FormLabel>
                       <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value} // Use value here instead of defaultValue for controlled component
                          className="flex flex-col space-y-2"
                        >
                          {localAiDetailOptionsConfig.map((option) => (
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
              )}
              <SubmitButton pending={isPending} />
            </form>
          </Form>
        </CardContent>
      </Card>

      {state.error && !state.success && state.submittedUrl === form.getValues("url") && 
       state.submittedProcessingOption === (form.getValues("processingMethod") === 'external_api' ? 'external_api' : form.getValues("localAiProcessingDetail")) && (
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

