
import { ThemeSwitcher } from '@/components/theme-switcher';

export function AppHeader() {
  return (
    <div className="mb-10 w-full relative py-4"> {/* Container with relative positioning for switcher, padding, and bottom margin */}
      
      {/* Theme Switcher absolutely positioned to the top-right corner of the container */}
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      
      {/* Text content: Title and Subtitle */}
      <div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          Markdown Fetcher
        </h1>
        <p className="mt-3 max-w-3xl text-xl sm:text-2xl text-muted-foreground leading-relaxed">
          Enter a URL to fetch its content and convert it to Markdown format.
        </p>
      </div>

    </div>
  );
}
