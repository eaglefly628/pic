"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User } from "@/types/user";
import {
  getUser,
  logout,
  mockConsultations,
  mockPurchases,
} from "@/lib/auth/mock-auth";

const statusLabels = {
  pending: { text: "待处理", class: "bg-champagne text-champagne-dark" },
  completed: { text: "已完成", class: "bg-green-100 text-green-700" },
  cancelled: { text: "已取消", class: "bg-gray-100 text-gray-500" },
  active: { text: "可使用", class: "bg-rose-soft text-rose-deep" },
  used: { text: "已使用", class: "bg-gray-100 text-gray-500" },
  expired: { text: "已过期", class: "bg-gray-100 text-gray-400" },
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"consultations" | "services">(
    "consultations"
  );
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push("/login");
      return;
    }
    setUser(u);
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-brand-text-light">加载中...</p>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* Profile Header */}
      <section className="bg-gradient-to-br from-champagne-light to-rose-soft-light py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-soft to-champagne mx-auto mb-3 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {user.nickname.charAt(0)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-brand-text">
            {user.nickname}
          </h1>
          <p className="text-sm text-brand-text-light mt-1">
            加入时间：{user.createdAt}
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex border-b border-champagne-dark/20 mb-6">
          <button
            onClick={() => setActiveTab("consultations")}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === "consultations"
                ? "text-rose-deep border-b-2 border-rose-deep"
                : "text-brand-text-light"
            }`}
          >
            咨询记录
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === "services"
                ? "text-rose-deep border-b-2 border-rose-deep"
                : "text-brand-text-light"
            }`}
          >
            已购服务
          </button>
        </div>

        {/* Consultations Tab */}
        {activeTab === "consultations" && (
          <div className="space-y-3">
            {mockConsultations.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-xl p-4 border border-champagne-dark/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-brand-text text-sm">
                    {record.topic}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${statusLabels[record.status].class}`}
                  >
                    {statusLabels[record.status].text}
                  </span>
                </div>
                <p className="text-xs text-warm-gray mb-1">{record.date}</p>
                {record.summary && (
                  <p className="text-xs text-brand-text-light">
                    {record.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Services Tab */}
        {activeTab === "services" && (
          <div className="space-y-3">
            {mockPurchases.map((purchase) => (
              <div
                key={purchase.id}
                className="bg-white rounded-xl p-4 border border-champagne-dark/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-brand-text text-sm">
                    {purchase.serviceName}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${statusLabels[purchase.status].class}`}
                  >
                    {statusLabels[purchase.status].text}
                  </span>
                </div>
                <p className="text-xs text-warm-gray">
                  购买时间：{purchase.purchaseDate}
                </p>
                <p className="text-xs text-warm-gray">
                  订单号：{purchase.orderId}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 space-y-3">
          <Link
            href="/services"
            className="block w-full text-center py-3 bg-gradient-to-r from-rose-deep to-rose-deep-dark text-white rounded-full font-medium hover:shadow-lg transition-shadow"
          >
            购买更多服务
          </Link>
          <button
            onClick={handleLogout}
            className="block w-full text-center py-3 text-warm-gray text-sm hover:text-rose-deep transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
