export default function ClubGalleryLightbox({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {urls.map((url) => (
        <div
          key={url}
          className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-slate-200/80 dark:ring-slate-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
