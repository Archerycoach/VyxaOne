import React from "react";
import Head from "next/head";
import { Navigation } from "./Navigation";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const pageTitle = title ? `${title} | Vyxa One CRM` : "Vyxa One CRM";

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
      </Head>

      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        <Navigation />
        
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}