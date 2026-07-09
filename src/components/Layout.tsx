import React from "react";
import Head from "next/head";
import { Navigation } from "./Navigation";
import { NotificationCenter } from "./NotificationCenter";

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

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-end h-14 px-4 sm:px-6 lg:px-8 border-b bg-white dark:bg-gray-950 shrink-0">
            <NotificationCenter />
          </header>

          <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}