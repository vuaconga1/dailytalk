import Image from "next/image";
import Link from "next/link";

export function Brand({ className = "", href = "/" }: { className?: string; href?: string }) {
  const content = (
    <div className={`inline-flex items-center ${className}`}>
      <Image
        src="/logo.png"
        alt="WeWIN Education"
        width={180}
        height={44}
        priority
        className="h-8 md:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group inline-block" title="WeWIN Education">
        {content}
      </Link>
    );
  }

  return content;
}
