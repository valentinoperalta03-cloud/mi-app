export default function ReservasLoading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md space-y-6 px-4 pb-24 pt-6" aria-busy aria-label="Cargando reservas">
      <div className="space-y-2">
        <div className="shimmer h-5 w-24 rounded-full" />
        <div className="shimmer h-8 w-48 rounded-2xl" />
        <div className="shimmer h-4 w-full max-w-xs rounded-xl" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-36 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
