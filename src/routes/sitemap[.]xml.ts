import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://vennova-care-clinic.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/auth", changefreq: "monthly", priority: "0.6" },
          { path: "/analytics", changefreq: "weekly", priority: "0.5" },
          { path: "/appointments", changefreq: "weekly", priority: "0.5" },
          { path: "/billing", changefreq: "weekly", priority: "0.5" },
          { path: "/patients", changefreq: "weekly", priority: "0.5" },
          { path: "/prescriptions", changefreq: "weekly", priority: "0.5" },
          { path: "/queue", changefreq: "daily", priority: "0.5" },
          { path: "/reminders", changefreq: "weekly", priority: "0.4" },
          { path: "/exports", changefreq: "monthly", priority: "0.3" },
          { path: "/imports", changefreq: "monthly", priority: "0.3" },
          { path: "/onboarding", changefreq: "monthly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
