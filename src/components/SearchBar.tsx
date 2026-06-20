/** Plain GET search form — works without client JS; the page reads `?q=`. */
export function SearchBar({
  placeholder,
  defaultValue,
}: {
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <form method="get" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="field max-w-md"
      />
      <button className="btn-primary">Search</button>
    </form>
  );
}
