
"use client";

import type {NextPage} from 'next';
import { useState, useEffect, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { LinkIcon, Loader2, ClipboardCopy, Check, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from '@/components/app-header';
import { fetchAndFormat, type FetchAndFormatState } from './actions';

const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL (e.g., https://example.com)." }),
});

const initialState: FetchAndFormatState = {
  markdown: null,
  error: null,
  success: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();
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

const MarkdownFetcherPage: NextPage = () => {
  const [state, formAction] = useFormState(fetchAndFormat, initialState);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
    },
  });

 useEffect(() => {
    if (state.success && state.markdown) {
      // Optionally, scroll to results or give other feedback
    }
    if (state.error) {
      form.setError("url", { type: "manual", message: state.error });
    }
    if (state.submittedUrl && state.submittedUrl !== form.getValues("url")) {
        // This might happen if form submitted with old data after URL change,
        // or if we want to reset form on new submission that comes from a different URL.
        // For now, let's ensure the input reflects what was submitted if an error occurred for that URL.
        // form.setValue("url", state.submittedUrl); 
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
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    startTransition(() => {
      const formData = new FormData();
      formData.append('url', data.url);
      formAction(formData);
    });
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-foreground">
      <AppHeader />

      <Card className="w-full max-w-2xl shadow-xl rounded-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Enter URL</CardTitle>
          <CardDescription>Paste a web address to fetch and format its content.</CardDescription>
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
                        className="py-3 text-base bg-background border-border focus:ring-primary focus:border-primary" 
                        aria-describedby="url-error"
                      />
                    </FormControl>
                    <FormMessage id="url-error" />
                  </FormItem>
                )}
              />
              <SubmitButton />
            </form>
          </Form>
        </CardContent>
      </Card>

      {state.error && !state.success && (
        <Alert variant="destructive" className="mt-6 w-full max-w-2xl shadow-lg rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error Fetching URL</AlertTitle>
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
      <Toaster />
    </div>
  );
};

export default MarkdownFetcherPage;
