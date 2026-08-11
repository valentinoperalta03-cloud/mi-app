export default function AdminFlashMessage({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  const isSuccess = type === "success";
  return (
    <p
      className={`rounded-[10px] px-4 py-3 text-sm font-medium ${
        isSuccess ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
      }`}
      style={{
        backgroundColor: isSuccess ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
        borderLeft: `3px solid ${isSuccess ? "#22C55E" : "#EF4444"}`,
      }}
    >
      {message}
    </p>
  );
}
