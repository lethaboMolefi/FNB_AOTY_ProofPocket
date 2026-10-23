// Outline icons for the founder tab bar (24px grid, currentColor).
const paths = {
  home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
  book: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4Zm0 12a4 4 0 0 1 4-4h10M9 8h6",
  pay: "M3 7h18v10H3zM3 10h18M7 14h3",
  store: "M4 9h16l-1-5H5L4 9Zm0 0v11h16V9M9 20v-6h6v6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export type IconName = keyof typeof paths;

export const Icon = ({ name }: { name: IconName }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "more" ? 3.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>
);
