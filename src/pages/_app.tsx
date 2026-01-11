import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { AppWrapper } from "@/components/AppWrapper";
import SEO from "@/components/SEO";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SEO />
      <AppWrapper>
        <Component {...pageProps} />
      </AppWrapper>
      <Toaster />
    </ThemeProvider>
  );
}