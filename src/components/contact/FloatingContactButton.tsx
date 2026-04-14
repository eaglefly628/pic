"use client";

import { useState } from "react";
import { brand } from "@/config/brand";

export default function FloatingContactButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-14 z-40">
      {/* Popup */}
      {open && (
        <div className="mb-3 bg-white rounded-2xl shadow-xl p-5 w-64 border border-champagne-dark/20">
          <h4 className="font-semibold text-brand-text mb-2">联系客服</h4>
          <p className="text-sm text-brand-text-light mb-3">
            添加微信客服，获取一对一专属咨询
          </p>

          {/* QR Placeholder */}
          <div className="w-full aspect-square bg-gradient-to-br from-champagne-light to-rose-soft-light rounded-xl flex items-center justify-center mb-3">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-warm-gray-light">
                <span className="text-xs text-warm-gray">二维码</span>
              </div>
              <p className="text-xs text-warm-gray mt-2">
                微信号：{brand.contact.wechatId}
              </p>
            </div>
          </div>

          {/* Mobile: open WeChat */}
          <a
            href={brand.contact.wechatServiceUrl}
            className="block w-full text-center py-2.5 bg-[#07C160] text-white rounded-full text-sm font-medium hover:bg-[#06AD56] transition-colors"
          >
            打开微信联系客服
          </a>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-deep to-champagne-dark text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="联系客服"
      >
        {open ? (
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
