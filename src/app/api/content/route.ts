import { NextResponse } from "next/server";
import { mockPosts } from "@/lib/content/mock-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const category = searchParams.get("category");

  let posts = [...mockPosts];

  if (platform && platform !== "all") {
    posts = posts.filter((p) => p.platform === platform);
  }

  if (category && category !== "全部") {
    posts = posts.filter((p) => p.category === category);
  }

  return NextResponse.json({ posts });
}
