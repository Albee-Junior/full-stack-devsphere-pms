const avatarColors = ["lavender", "coral", "mint", "blue", "yellow"];

export default function Avatar({ name = "Teammate", size = "", className = "" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const colorIndex = [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % avatarColors.length;
  return (
    <span
      className={`avatar avatar-${avatarColors[colorIndex]} ${size ? `avatar-${size}` : ""} ${className}`}
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ names = [], limit = 3 }) {
  return (
    <span className="avatar-stack" aria-label={`${names.length} teammates`}>
      {names.slice(0, limit).map((name) => <Avatar key={name} name={name} size="small" />)}
      {names.length > limit && <span className="avatar-extra">+{names.length - limit}</span>}
    </span>
  );
}
