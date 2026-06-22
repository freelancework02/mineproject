export default function TextInput({ label, error, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        {...props}
      />
      {error ? <span className="mt-1 block text-sm text-coral">{error}</span> : null}
    </label>
  );
}
