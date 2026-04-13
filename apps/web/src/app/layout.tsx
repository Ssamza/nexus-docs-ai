import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexusDocs AI",
  description: "Tu asesor laboral y financiero personal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
      localization={{
      ...esES,
      signIn: {
        ...esES.signIn,
        start: {
          ...esES.signIn?.start,
          title: "Inicia sesión",
          subtitle: "para continuar en NexusDocs AI",
        },
      },
      signUp: {
        ...esES.signUp,
        start: {
          ...esES.signUp?.start,
          subtitle: "para continuar en NexusDocs AI",
        },
      },
    }
    }>
      <html lang="es">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
