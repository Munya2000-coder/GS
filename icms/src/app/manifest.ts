import type { MetadataRoute } from "next";

// PWA manifest (PRD Module 30 — installable mobile-responsive web app).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ICMS — ELMS Health Solutions",
    short_name: "ICMS",
    description: "Immigration Compliance Management System",
    start_url: "/",
    display: "standalone",
    background_color: "#1A2D3F",
    theme_color: "#00A99D",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
