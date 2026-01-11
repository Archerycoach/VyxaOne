import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { AppWrapper } from "@/components/AppWrapper";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AppWrapper>
        <Component {...pageProps} />
        <Toaster />
      </AppWrapper>
    </ThemeProvider>
  );
}