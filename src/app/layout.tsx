import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import GlobalDisclaimer from "@/components/layout/GlobalDisclaimer";
import FloatingContactButton from "@/components/contact/FloatingContactButton";

export const metadata: Metadata = {
  title: "糖糖和小希 - 你的医美避雷闺蜜",
  description:
    "拒绝盲目变美，用真实数据和专业审美，陪你做出最适合自己的选择。糖糖和小希，医美信息中介与咨询服务平台。",
  keywords: "医美咨询,医美避雷,医美陪诊,变美方案,医美信息",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <FloatingContactButton />
        <GlobalDisclaimer />
      </body>
    </html>
  );
}
