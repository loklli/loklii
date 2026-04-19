import { Star } from 'lucide-react';

export default function StarRating({ rating, size = 16 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? 'text-amber fill-amber' : 'text-gray-300 fill-gray-300'}
        />
      ))}
      <span className="ml-1 text-sm text-gray-600">{rating?.toFixed(1)}</span>
    </div>
  );
}
