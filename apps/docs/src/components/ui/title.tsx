import Image from "next/image";

export function Title() {
  return (
    <div className="group flex cursor-pointer items-center gap-2">
      <Image
        src="/logo-mark-standard.svg"
        alt="sovseal"
        width={32}
        height={32}
        className="rounded transition-all"
      />
      <span className="text-xl font-semibold tracking-tight lowercase">
        sovseal
      </span>
    </div>
  );
}
