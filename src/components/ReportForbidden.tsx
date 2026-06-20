export function Forbidden() {
  return (
    <div>
      <h1 className="text-2xl font-medium">Reports</h1>
      <p className="mt-2 rounded-md bg-due-bg px-3 py-2 text-sm text-due">
        You do not have permission to view reports.
      </p>
    </div>
  );
}
