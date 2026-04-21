export default function ComunidadLoading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md space-y-6 px-4 pb-24 pt-6" aria-busy aria-label="Cargando comunidad">
      <div className="space-y-2">
        <div className="shimmer h-5 w-28 rounded-full" />
        <div className="shimmer h-8 w-40 rounded-2xl" />
      </div>
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="shimmer h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
