import Image from 'next/image';

interface DynamicBannerProps {
  title: string;
  description: string;
  icon?: string;
  alt?: string;
  priority?: boolean;
}

export default function DynamicBanner({ 
  title, 
  description, 
  icon = '⛪', 
  alt,
  priority = false 
}: DynamicBannerProps) {
  // Lakukan encode parameter agar karakter khusus (seperti spasi & emoji) aman di dalam URL
  const imageUrl = `/api/admin/generate-image?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&icon=${encodeURIComponent(icon)}`;
  
  return (
    <div className="relative w-full aspect-[1200/630] overflow-hidden rounded-lg shadow-md bg-gray-100">
      <Image
        src={imageUrl}
        alt={alt || `Banner artikel: ${title} - ${description}`}
        fill
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}