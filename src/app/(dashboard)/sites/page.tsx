import { prisma } from "@/lib/db";
import { SiteCreateForm } from "@/components/SiteCreateForm";
import { SiteCard } from "@/components/SiteCard";

const mapboxToken = process.env.MAPBOX_TOKEN;

const buildStaticMapUrl = (lat: number, lng: number) => {
  if (!mapboxToken) return null;
  const marker = `pin-s+0f172a(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${lng},${lat},14/500x240?access_token=${mapboxToken}`;
};

export default async function SitesPage() {
  const sites = await prisma.site.findMany({
    include: { devices: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Sites</h2>
        <p className="text-sm text-slate-600">設置場所の管理と地図表示</p>
      </div>

      <SiteCreateForm />

      <div className="grid gap-4 md:grid-cols-2">
        {sites.map((site) => {
          const mapUrl = site.lat && site.lng ? buildStaticMapUrl(site.lat, site.lng) : null;
          return <SiteCard key={site.id} site={site} mapUrl={mapUrl} />;
        })}
        {sites.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            サイトが登録されていません
          </div>
        )}
      </div>
    </div>
  );
}
