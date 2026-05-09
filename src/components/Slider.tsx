interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  hint?: string;
}

export default function Slider({ label, value, min = 0, max = 10, onChange, hint }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackStyle = {
    background: `linear-gradient(to right, #c0233a 0%, #8a0e1a ${pct}%, #1d1014 ${pct}%, #1d1014 100%)`,
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="label !mb-0">{label}</span>
        <span className="text-bone font-display text-lg">{value} <span className="text-ash text-xs">/ {max}</span></span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        style={trackStyle}
      />
      {hint && <p className="text-xs text-ash mt-1">{hint}</p>}
    </div>
  );
}
