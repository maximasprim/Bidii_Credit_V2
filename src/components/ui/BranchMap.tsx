import { useEffect, useRef, useState } from "react";
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
import type { Branch } from "../../lib/useBranches";

const containerStyle = { width: "100%", height: "100%", minHeight: 420 };
const DEFAULT_CENTER = { lat: -1.2833, lng: 36.8235 };

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  scrollwheel: false,
  clickableIcons: false,
};

export default function BranchMap({ branches }: { branches: Branch[] }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey ?? "",
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);

  // Fit the map to every branch's coordinates whenever the (possibly
  // search-filtered) branch list changes, instead of a fixed zoom/center.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || branches.length === 0) return;

    if (branches.length === 1) {
      map.panTo({ lat: branches[0].lat, lng: branches[0].lng });
      map.setZoom(12);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    branches.forEach((b) => bounds.extend({ lat: b.lat, lng: b.lng }));
    map.fitBounds(bounds, 40);
  }, [branches, isLoaded]);

  if (!apiKey) {
    return (
      <div
        className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"
        style={{ backgroundColor: "var(--color-mist-100)" }}
      >
        <p className="max-w-xs text-sm leading-relaxed text-ink-500">
          Set <code className="rounded bg-mist-200 px-1.5 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> in
          your <code className="rounded bg-mist-200 px-1.5 py-0.5">.env</code> file to display the map.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex min-h-[420px] items-center justify-center p-8 text-center"
        style={{ backgroundColor: "var(--color-mist-100)" }}
      >
        <p className="text-sm text-ink-500">Couldn't load Google Maps. Check your API key and billing status.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="flex min-h-[420px] items-center justify-center"
        style={{ backgroundColor: "var(--color-mist-100)" }}
      >
        <p className="text-sm text-ink-500">Loading map…</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={branches[0] ? { lat: branches[0].lat, lng: branches[0].lng } : DEFAULT_CENTER}
      zoom={6}
      options={mapOptions}
      onLoad={(map) => {
        mapRef.current = map;
      }}
    >
      {branches.map((b) => (
        <MarkerF
          key={b.id}
          position={{ lat: b.lat, lng: b.lng }}
          onClick={() => setActiveBranch(b)}
        />
      ))}

      {activeBranch && (
        <InfoWindowF
          position={{ lat: activeBranch.lat, lng: activeBranch.lng }}
          onCloseClick={() => setActiveBranch(null)}
        >
          <div>
            <p className="font-semibold">{activeBranch.name}</p>
            <p className="text-xs">{activeBranch.address}</p>
            <p className="text-xs">{activeBranch.phone}</p>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}


// import { useEffect, useRef, useState } from "react";
// import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
// import type { branches as BranchList } from "../../data/content";

// type Branch = (typeof BranchList)[number];

// const containerStyle = { width: "100%", height: "100%", minHeight: 420 };
// const DEFAULT_CENTER = { lat: -1.2833, lng: 36.8235 };

// const mapOptions: google.maps.MapOptions = {
//   disableDefaultUI: false,
//   zoomControl: true,
//   scrollwheel: false,
//   clickableIcons: false,
// };

// export default function BranchMap({ branches }: { branches: Branch[] }) {
//   const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
//   const { isLoaded, loadError } = useJsApiLoader({
//     id: "google-map-script",
//     googleMapsApiKey: apiKey ?? "",
//   });

//   const mapRef = useRef<google.maps.Map | null>(null);
//   const [activeBranch, setActiveBranch] = useState<Branch | null>(null);

//   // Fit the map to every branch's coordinates whenever the (possibly
//   // search-filtered) branch list changes, instead of a fixed zoom/center.
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map || !isLoaded || branches.length === 0) return;

//     if (branches.length === 1) {
//       map.panTo({ lat: branches[0].lat, lng: branches[0].lng });
//       map.setZoom(12);
//       return;
//     }

//     const bounds = new google.maps.LatLngBounds();
//     branches.forEach((b) => bounds.extend({ lat: b.lat, lng: b.lng }));
//     map.fitBounds(bounds, 40);
//   }, [branches, isLoaded]);

//   if (!apiKey) {
//     return (
//       <div
//         className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"
//         style={{ backgroundColor: "var(--color-mist-100)" }}
//       >
//         <p className="max-w-xs text-sm leading-relaxed text-ink-500">
//           Set <code className="rounded bg-mist-200 px-1.5 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> in
//           your <code className="rounded bg-mist-200 px-1.5 py-0.5">.env</code> file to display the map.
//         </p>
//       </div>
//     );
//   }

//   if (loadError) {
//     return (
//       <div
//         className="flex min-h-[420px] items-center justify-center p-8 text-center"
//         style={{ backgroundColor: "var(--color-mist-100)" }}
//       >
//         <p className="text-sm text-ink-500">Couldn't load Google Maps. Check your API key and billing status.</p>
//       </div>
//     );
//   }

//   if (!isLoaded) {
//     return (
//       <div
//         className="flex min-h-[420px] items-center justify-center"
//         style={{ backgroundColor: "var(--color-mist-100)" }}
//       >
//         <p className="text-sm text-ink-500">Loading map…</p>
//       </div>
//     );
//   }

//   return (
//     <GoogleMap
//       mapContainerStyle={containerStyle}
//       center={branches[0] ? { lat: branches[0].lat, lng: branches[0].lng } : DEFAULT_CENTER}
//       zoom={6}
//       options={mapOptions}
//       onLoad={(map) => {
//         mapRef.current = map;
//       }}
//     >
//       {branches.map((b) => (
//         <MarkerF
//           key={b.name}
//           position={{ lat: b.lat, lng: b.lng }}
//           onClick={() => setActiveBranch(b)}
//         />
//       ))}

//       {activeBranch && (
//         <InfoWindowF
//           position={{ lat: activeBranch.lat, lng: activeBranch.lng }}
//           onCloseClick={() => setActiveBranch(null)}
//         >
//           <div>
//             <p className="font-semibold">{activeBranch.name}</p>
//             <p className="text-xs">{activeBranch.address}</p>
//             <p className="text-xs">{activeBranch.phone}</p>
//           </div>
//         </InfoWindowF>
//       )}
//     </GoogleMap>
//   );
// }
