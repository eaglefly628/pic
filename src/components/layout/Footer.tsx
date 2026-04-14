import Link from "next/link";
import { brand } from "@/config/brand";

export default function Footer() {
  return (
    <footer className="bg-warm-gray-dark text-champagne-light pb-20">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{brand.name}</h3>
            <p className="text-sm text-warm-gray-light">{brand.tagline}</p>
            <p className="text-xs text-warm-gray-light mt-4">
              {brand.description}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-3">快速链接</h4>
            <div className="space-y-2">
              <Link
                href="/consultation"
                className="block text-sm text-warm-gray-light hover:text-white transition-colors"
              >
                咨询服务
              </Link>
              <Link
                href="/cases"
                className="block text-sm text-warm-gray-light hover:text-white transition-colors"
              >
                真实案例
              </Link>
              <Link
                href="/services"
                className="block text-sm text-warm-gray-light hover:text-white transition-colors"
              >
                服务项目
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-3">联系我们</h4>
            <p className="text-sm text-warm-gray-light">
              微信客服：{brand.contact.wechatId}
            </p>
            <p className="text-xs text-warm-gray-light mt-4">
              平台类型：信息服务 / 生活服务咨询
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-warm-gray text-center text-xs text-warm-gray-light">
          <p>
            &copy; {new Date().getFullYear()} {brand.name} ({brand.nameEn}).
            保留所有权利。
          </p>
          <p className="mt-1">ICP备案号：待备案</p>
        </div>
      </div>
    </footer>
  );
}
