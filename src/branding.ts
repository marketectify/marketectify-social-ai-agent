/** Who made the app. Shown in the black bar at the top of every page. Empty values are simply not shown. */
export const BRAND = {
  company: "Marketectify",
  /** Company website (must start with https://). */
  website: "",
  email: "marketectify@gmail.com",
  /** Phone as people dial it, for example "+92 300 1234567". */
  phone: "",
  author: "Umer Adil",
};

/** Keeps only the characters a tel: link needs. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, "")}`;
