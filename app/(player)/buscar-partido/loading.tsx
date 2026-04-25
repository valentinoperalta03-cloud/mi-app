export default function BuscarPartidoLoading() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-6">
      <div className="shimmer h-8 w-48 rounded-xl" />
      <div className="shimmer h-12 w-full rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-8 w-24 rounded-full" />
        ))}
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="shimmer h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}
