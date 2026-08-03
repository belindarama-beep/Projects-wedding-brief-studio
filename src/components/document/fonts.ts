import { IBM_Plex_Mono, IBM_Plex_Sans, Beau_Rivage } from "next/font/google";

export const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

export const beauRivage = Beau_Rivage({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-beau-rivage",
});
