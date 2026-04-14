import { SocialPost } from "@/types/content";
import ContentCard from "./ContentCard";

export default function ContentFeed({ posts }: { posts: SocialPost[] }) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
      {posts.map((post) => (
        <ContentCard key={post.id} post={post} />
      ))}
    </div>
  );
}
