export default function BrandName({ className = "" }) {
  return (
    <span className={`brand-name inline-block ${className}`}>
      <span className="text-[#edaf39]">Pastry</span>{" "}
      <span className="text-[#25211a]">Project</span>
    </span>
  );
}
