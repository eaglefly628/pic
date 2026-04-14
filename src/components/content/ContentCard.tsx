import { SocialPost } from "@/types/content";
import PlatformBadge from "./PlatformBadge";

export default function ContentCard({ post }: { post: SocialPost }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-champagne-dark/10 hover:shadow-lg transition-all group break-inside-avoid mb-4">
      {/* Cover placeholder with gradient */}
      <div
        className={`w-full aspect-[4/3] bg-gradient-to-br ${post.coverGradient} flex items-center justify-center relative`}
      >
        <div className="text-center p-4">
          <span className="text-sm text-brand-text/60 bg-white/50 px-3 py-1 rounded-full">
            {post.category}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <PlatformBadge platform={post.platform} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-brand-text text-sm leading-snug mb-2 group-hover:text-rose-deep transition-colors line-clamp-2">
          {post.title}
        </h3>
        <p className="text-xs text-brand-text-light leading-relaxed mb-3 line-clamp-2">
          {post.summary}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-warm-gray">
          <span>{post.author}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              {post.likes >= 10000
                ? `${(post.likes / 10000).toFixed(1)}万`
                : post.likes}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {post.comments}
            </span>
          </div>
        </div>

        {/* View Original */}
        <a
          href={post.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full text-center py-2 text-xs text-rose-deep border border-rose-soft rounded-full hover:bg-rose-soft-light transition-colors"
        >
          查看原文
        </a>
      </div>
    </div>
  );
}
