/** Figma-exported SVGs retain their intrinsic dimensions. */
export function DesignIcon({ section, index, className = '' }: { section: string; index: number; className?: string }) {
  return <img className={`design-icon ${className}`} src={`/images/landing/${section}-${index}.svg`} alt="" aria-hidden="true" />;
}
