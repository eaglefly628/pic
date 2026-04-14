import { NextResponse } from "next/server";

// Mock WeChat OAuth callback handler
// In production, this would:
// 1. Exchange code for access_token
// 2. Get user info via access_token
// 3. Create/update user in database
// 4. Set session cookie
export async function POST(request: Request) {
  const body = await request.json();
  const { code } = body;

  if (!code) {
    return NextResponse.json({ error: "缺少授权码" }, { status: 400 });
  }

  // Mock response simulating WeChat OAuth
  const mockUserInfo = {
    openid: "mock_openid_" + Date.now(),
    nickname: "爱美的小鹿",
    headimgurl: "",
  };

  return NextResponse.json({
    success: true,
    user: {
      id: "u_" + Date.now(),
      nickname: mockUserInfo.nickname,
      avatar: mockUserInfo.headimgurl,
      wechatOpenId: mockUserInfo.openid,
      createdAt: new Date().toISOString().split("T")[0],
    },
  });
}
