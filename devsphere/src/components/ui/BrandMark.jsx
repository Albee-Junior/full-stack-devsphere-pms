export default function BrandMark({ className = "", onClick, label = "DevSphere" }) {
  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`brand-mark ${className}`.trim()}
      onClick={onClick}
      aria-label={onClick ? label : undefined}
    >
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="brand-name">Dev<span>Sphere</span></span>
    </Tag>
  );
}
