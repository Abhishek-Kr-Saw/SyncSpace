/**
 * Inline tool activity chip for AI chat.
 * Shows a spinner during "start" and a checkmark on "end".
 * Updates in-place rather than stacking duplicates.
 */
export default function ToolActivityChip({ tool, status, files }) {
  const isComplete = status === 'end';

  // Human-readable label for each tool
  const toolLabels = {
    list_files: 'Listing files',
    read_files: 'Reading',
    update_files: 'Updating',
  };

  const completedLabels = {
    list_files: 'Listed files',
    read_files: 'Read',
    update_files: 'Updated',
  };

  const label = isComplete
    ? (completedLabels[tool] || tool)
    : (toolLabels[tool] || tool);

  const fileNames = files && files.length > 0
    ? files.map((f) => f.split('/').pop()).join(', ')
    : '';

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all duration-300 my-1"
      style={{
        backgroundColor: isComplete
          ? 'rgba(34, 197, 94, 0.1)'
          : 'rgba(62, 207, 180, 0.1)',
        border: `1px solid ${isComplete ? 'rgba(34, 197, 94, 0.2)' : 'rgba(62, 207, 180, 0.2)'}`,
        color: isComplete ? 'var(--success)' : 'var(--accent)',
      }}
    >
      {/* Icon: spinner or checkmark */}
      {isComplete ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin">
          <circle cx="6" cy="6" r="4.5" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="5" strokeLinecap="round" />
        </svg>
      )}

      <span>
        {label}{fileNames ? ` ${fileNames}` : ''}
      </span>
    </div>
  );
}
