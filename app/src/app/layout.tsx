import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Zapnit — WhatsApp Business API com IA",
  description:
    "Conecte seu negócio ao WhatsApp Business com chatbot inteligente, filas de mensagens e multi-tenant. A infraestrutura de mensageria que escala com você.",
  keywords: ["WhatsApp Business API", "chatbot IA", "mensageria", "automação"],
  openGraph: {
    title: "Zapnit — WhatsApp Business API com IA",
    description: "Conecte seu negócio ao WhatsApp Business com chatbot inteligente.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
