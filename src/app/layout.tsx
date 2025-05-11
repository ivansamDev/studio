import type {Metadata} from 'next';
import { Nunito_Sans } from 'next/font/google'; // Changed from Geist to Nunito_Sans
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

// Configure Nunito Sans font
const nunitoSans = Nunito_Sans({
  variable: '--font-nunito-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700'], // Include weights used on liveconnect.chat
});

export const metadata: Metadata = {
  title: 'Markdown Fetcher',
  description: 'Fetch content from a URL and convert it to Markdown.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply Nunito Sans variable to the body */}
      <body className={`${nunitoSans.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
