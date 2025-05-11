
import { LinkIcon } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme-switcher';

export function AppHeader() {
  return (
    <div className="mb-8 text-center w-full relative">
      <div className="flex items-center justify-center mb-2">
        <LinkIcon className="h-10 w-10 text-primary" />
        <h1 className="ml-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Markdown Fetcher
        </h1>
      </div>
      <p className="text-lg text-muted-foreground">
        Enter a URL to fetch its content and convert it to Markdown format.
      </p>
      <div className="absolute top-0 right-0">
        <ThemeSwitcher />
      </div>
    </div>
  );
}
