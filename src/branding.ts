/** Who made the app. Shown in the black bar at the top of every page. Empty values are simply not shown. */
export const BRAND = {
  company: "Marketectify",
  /** Company website (must start with https://). */
  website: "https://marketectify.com/",
  email: "info@marketectify.com",
  /** Phone as people dial it, for example "+92 300 1234567". */
  phone: "0319 3529519",
  author: "Umer Adil",
};

/** tel: link. A Pakistani number written with a leading 0 is dialled with +92 so it also works from abroad. */
export const telHref = (phone: string): string => {
  const d = phone.replace(/[^\d+]/g, "");
  return `tel:${d.startsWith("0") ? "+92" + d.slice(1) : d}`;
};
