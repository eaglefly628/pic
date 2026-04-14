"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WechatLoginButton from "@/components/auth/WechatLoginButton";
import { login } from "@/lib/auth/mock-auth";
import { brand } from "@/config/brand";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = () => {
    setLoading(true);
    // Simulate WeChat OAuth flow
    setTimeout(() => {
      login();
      router.push("/profile");
    }, 1500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-champagne-light to-rose-soft-light px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-soft to-champagne mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">糖希</span>
          </div>
          <h1 className="text-xl font-bold text-brand-text">{brand.name}</h1>
          <p className="text-sm text-brand-text-light mt-1">{brand.tagline}</p>
        </div>

        {/* Mock WeChat Login */}
        <div className="space-y-4">
          <WechatLoginButton onLogin={handleLogin} loading={loading} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-champagne-dark/20" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-warm-gray">
                微信授权即可登录
              </span>
            </div>
          </div>

          <p className="text-xs text-warm-gray text-center leading-relaxed">
            登录即表示您同意{brand.name}的服务协议和隐私政策。
            我们仅获取您的微信昵称和头像信息。
          </p>
        </div>
      </div>
    </div>
  );
}
