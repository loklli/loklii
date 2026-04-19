export default function Logo({ size = 'md' }) {
  const sizes = { sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl' };
  return (
    <span className={`font-bold ${sizes[size]}`}>
      <span className="text-amber">Lok</span>
      <span className="text-gray-900">lii</span>
    </span>
  );
}
