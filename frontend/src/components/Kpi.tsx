interface Props {
  label: string;
  value: string | number;
  sub?: string;
}

export default function Kpi({ label, value, sub }: Props) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}
