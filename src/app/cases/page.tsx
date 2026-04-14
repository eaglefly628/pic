"use client";

import { useState } from "react";
import ContentFeed from "@/components/content/ContentFeed";
import { mockPosts, categories } from "@/lib/content/mock-data";
import { Platform } from "@/types/content";

export default function CasesPage() {
  const [activeCategory, setActiveCategory] = useState("全部");
  const [activePlatform, setActivePlatform] = useState<Platform | "all">(
    "all"
  );

  const filteredPosts = mockPosts.filter((post) => {
    const categoryMatch =
      activeCategory === "全部" || post.category === activeCategory;
    const platformMatch =
      activePlatform === "all" || post.platform === activePlatform;
    return categoryMatch && platformMatch;
  });

  return (
    <div className="pb-16">
      {/* Header */}
      <section className="bg-gradient-to-br from-rose-soft-light to-champagne-light py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-text mb-3">
            真实案例
          </h1>
          <p className="text-brand-text-light max-w-lg mx-auto">
            内容来源于第三方平台，仅供参考。点击"查看原文"跳转至原始平台查看完整内容。
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-8 space-y-4">
          {/* Platform Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-warm-gray mr-1">平台：</span>
            {(
              [
                { value: "all", label: "全部" },
                { value: "xiaohongshu", label: "小红书" },
                { value: "douyin", label: "抖音" },
              ] as const
            ).map((p) => (
              <button
                key={p.value}
                onClick={() => setActivePlatform(p.value)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                  activePlatform === p.value
                    ? "bg-rose-deep text-white"
                    : "bg-white text-brand-text-light border border-champagne-dark/20 hover:border-rose-soft"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-warm-gray mr-1">分类：</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                  activeCategory === cat
                    ? "bg-champagne-dark text-white"
                    : "bg-white text-brand-text-light border border-champagne-dark/20 hover:border-champagne"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content Feed */}
        {filteredPosts.length > 0 ? (
          <ContentFeed posts={filteredPosts} />
        ) : (
          <div className="text-center py-20">
            <p className="text-brand-text-light">暂无相关内容</p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-warm-gray text-center mt-8">
          以上内容均来源于第三方社交媒体平台的公开信息，仅作为参考展示。
          糖糖和小希不对第三方内容的准确性和完整性负责。
        </p>
      </div>
    </div>
  );
}
