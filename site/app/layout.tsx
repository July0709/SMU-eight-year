import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "南医八年｜医学学习知识库",
    description: "南方医科大学八年制课程笔记、影像资料与临床思维知识库。",
    openGraph: {
      title: "南医八年｜医学学习知识库",
      description: "让医学知识有迹可循。课程笔记、影像资料与临床思维的个人知识库。",
      type: "website",
      images: [{ url: image, width: 1536, height: 1024, alt: "南医八年医学学习知识库" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "南医八年｜医学学习知识库",
      description: "让医学知识有迹可循。",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
