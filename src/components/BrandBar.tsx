import { BRAND, telHref } from "../branding";

const link = "hover:text-white underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-white rounded-sm";

/** Thin black bar fixed to the top of the page (28px, see --brand-bar in index.css). */
export default function BrandBar() {
  return (
    <div
      role="complementary"
      aria-label="About the makers"
      className="fixed top-0 inset-x-0 z-[100] h-7 bg-black text-slate-300 text-[11px] leading-none flex items-center justify-center gap-x-3 px-3 overflow-hidden whitespace-nowrap"
    >
      <span className="shrink-0">
        Made by{" "}
        {BRAND.website ? (
          <a href={BRAND.website} target="_blank" rel="noopener noreferrer" className={`font-semibold text-white ${link}`}>
            {BRAND.company}
          </a>
        ) : (
          <span className="font-semibold text-white">{BRAND.company}</span>
        )}
      </span>
      {BRAND.email && (
        <a href={`mailto:${BRAND.email}`} className={`hidden sm:inline truncate ${link}`}>
          {BRAND.email}
        </a>
      )}
      {BRAND.phone && (
        <a href={telHref(BRAND.phone)} className={`hidden md:inline ${link}`}>
          {BRAND.phone}
        </a>
      )}
      <span className="hidden sm:inline text-slate-500" aria-hidden="true">|</span>
      <span className="hidden sm:inline shrink-0">Made by {BRAND.author}</span>
    </div>
  );
}
