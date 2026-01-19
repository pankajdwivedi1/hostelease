"use client";

import { MapContainer, TileLayer, useMapEvents, useMap, Circle, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useMemo } from "react";
import L from "leaflet";
// @ts-ignore
import { OpenStreetMapProvider, EsriProvider } from 'leaflet-geosearch';

// Fix for default markers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerMapProps {
    lat: number;
    lng: number;
    radius?: number;
    zoom?: number;
    onMove: (lat: number, lng: number) => void;
}

function MapUpdater({ lat, lng, zoom }: { lat: number, lng: number, zoom?: number }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            const center = map.getCenter();
            const dist = Math.sqrt(Math.pow(center.lat - lat, 2) + Math.pow(center.lng - lng, 2));
            if (dist > 0.00001) {
                const targetZoom = zoom || map.getZoom();
                // Faster fly animation (0.5s) for snappy feel
                map.flyTo([lat, lng], targetZoom, { duration: 0.5 });
            }
        }
    }, [lat, lng, zoom, map]);
    return null;
}

function MapEvents({ onMove }: { onMove: (lat: number, lng: number) => void }) {
    const map = useMapEvents({
        moveend: () => {
            const center = map.getCenter();
            onMove(center.lat, center.lng);
        },
    });
    return null;
}

function LocateControl({ onLocate }: { onLocate: () => void }) {
    return (
        <button
            onClick={onLocate}
            className="bg-white text-gray-700 p-2.5 rounded shadow-md hover:bg-gray-50 focus:outline-none transition-colors duration-200 flex items-center justify-center border border-gray-300"
            title="Locate Me"
            type="button"
        >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
            </svg>
        </button>
    );
}

export default function LocationPickerMap({ lat, lng, radius = 100, zoom, onMove }: LocationPickerMapProps) {
    const displayLat = lat || 20.5937;
    const displayLng = lng || 78.9629;
    const initialZoom = zoom || (lat && lng ? 18 : 5);



    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-gray-200 group">

            {/* --- Center Crosshair --- */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none drop-shadow-lg">
                <svg className="w-10 h-10 text-red-600 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24" stroke="white" strokeWidth="1">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
            </div>

            <MapContainer
                center={[displayLat, displayLng]}
                zoom={initialZoom}
                minZoom={3}
                maxZoom={22}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
                zoomControl={false} // Disable default zoom control
            >
                {/* Google Maps Hybrid Layer (Satellite + Labels) */}
                <TileLayer
                    url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
                    attribution="Google"
                    // maxNativeZoom 19 ensures we use the highest quality available satellite tile
                    // and scale it up, rather than trying to fetch non-existent zoom 21 tiles which look blurry.
                    maxNativeZoom={19}
                    maxZoom={22}
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                />

                {lat && lng ? (
                    <Circle
                        center={[lat, lng]}
                        radius={radius}
                        pathOptions={{ color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.15, weight: 2, dashArray: '5, 10' }}
                    />
                ) : null}

                <MapUpdater lat={lat} lng={lng} zoom={zoom} />
                <MapEvents onMove={onMove} />
            </MapContainer>
        </div>
    );
}
