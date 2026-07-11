// Shared visual for the app's generated icons (favicon, apple touch icon,
// manifest icons) — a checkmark on the same blue used for primary actions
// throughout the UI (bg-blue-600).
export function iconMark(strokeWidth: number) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2563eb',
      }}
    >
      <svg width="62%" height="62%" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6 9 17l-5-5"
          stroke="white"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
