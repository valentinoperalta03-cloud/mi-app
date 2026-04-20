"use client";

import { useEffect, useRef } from "react";

type Props = {
  clubs: {
    id: string | number;
    name: string | null;
    latitude?: number | null;
    longitude?: number | null;
    location?: string | null;
  }[];
  userLocation: { lat: number; lng: number } | null;
  onClubClick: (clubId: string | number) => void;
};

export default function ClubsMap({ clubs, userLocation, onClubClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const center: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [-32.9468, -60.6393];

      const map = L.map(mapRef.current!).setView(center, 13);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      if (userLocation) {
        const userIcon = L.divIcon({
          html: '<div style="background:#0ea5e9;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>',
          iconSize: [16, 16],
          className: "",
        });
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map).bindPopup("Tu ubicación");
      }

      clubs.forEach((club) => {
        if (!club.latitude || !club.longitude) return;

        const clubIcon = L.divIcon({
          html: `<div style="background:#1e293b;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${club.name ?? "Club"}</div>`,
          className: "",
          iconAnchor: [0, 0],
        });

        L.marker([club.latitude, club.longitude], { icon: clubIcon })
          .addTo(map)
          .on("click", () => onClubClick(club.id))
          .bindPopup(`
            <b>${club.name ?? "Club"}</b><br>
            ${club.location ?? ""}<br>
            <a href="/clubes/${club.id}" style="color:#0ea5e9">Ver canchas →</a>
          `);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, [clubs, userLocation, onClubClick]);

  return <div ref={mapRef} className="w-full overflow-hidden rounded-2xl" style={{ height: "60vh", minHeight: "300px" }} />;
}
