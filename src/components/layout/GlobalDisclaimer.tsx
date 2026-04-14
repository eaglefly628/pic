import { brand } from "@/config/brand";

export default function GlobalDisclaimer() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-warm-gray-dark/95 backdrop-blur-sm text-white text-center py-2 px-4">
      <p className="text-xs leading-relaxed max-w-4xl mx-auto">
        <span className="inline-block w-2 h-2 bg-rose-soft rounded-full mr-1.5 align-middle" />
        {brand.disclaimer}
      </p>
    </div>
  );
}
