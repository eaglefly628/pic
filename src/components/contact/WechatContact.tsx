import { brand } from "@/config/brand";

export default function WechatContact() {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-champagne-dark/10 max-w-sm mx-auto">
      <h3 className="text-lg font-semibold text-brand-text text-center mb-4">
        添加专属顾问
      </h3>

      {/* QR Code Placeholder */}
      <div className="w-full aspect-square max-w-[240px] mx-auto bg-gradient-to-br from-champagne-light to-rose-soft-light rounded-2xl flex items-center justify-center mb-4">
        <div className="text-center">
          <div className="w-40 h-40 mx-auto bg-white rounded-xl flex items-center justify-center border-2 border-dashed border-warm-gray-light">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto text-warm-gray-light mb-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path d="M6.75 6.75h.75v.75h-.75zM6.75 16.5h.75v.75h-.75zM16.5 6.75h.75v.75H16.5zM13.5 13.5h.75v.75h-.75zM13.5 19.5h.75v.75h-.75zM19.5 13.5h.75v.75h-.75zM19.5 19.5h.75v.75h-.75zM16.5 16.5h.75v.75H16.5z" />
              </svg>
              <span className="text-xs text-warm-gray">微信二维码</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-brand-text-light mb-4">
        微信号：
        <span className="font-medium text-brand-text">
          {brand.contact.wechatId}
        </span>
      </p>

      {/* WeChat deep link for mobile */}
      <a
        href={brand.contact.wechatServiceUrl}
        className="block w-full text-center py-3 bg-[#07C160] text-white rounded-full text-sm font-medium hover:bg-[#06AD56] transition-colors"
      >
        <svg
          className="w-5 h-5 inline-block mr-1.5 -mt-0.5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.97 4.243c-3.882 0-7.164 2.626-7.164 5.96 0 3.334 3.282 5.96 7.164 5.96a8.63 8.63 0 002.36-.33.724.724 0 01.59.081l1.57.919a.267.267 0 00.138.045.242.242 0 00.24-.243c0-.06-.024-.118-.04-.176l-.322-1.222a.49.49 0 01.176-.548C21.86 19.792 22.732 18.14 22.732 16.194c0-3.334-2.85-5.96-7.164-5.96zm-2.508 3.308c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm5.015 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982z" />
        </svg>
        打开微信联系客服
      </a>

      <p className="text-center text-xs text-warm-gray mt-3">
        工作时间：每日 9:00 - 21:00
      </p>
    </div>
  );
}
