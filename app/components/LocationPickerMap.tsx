import { MapContainer, TileLayer, useMapEvents, useMap, Circle, Marker, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import React, { useEffect, useRef, memo } from "react";
import L from "leaflet";

// Fix for default markers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// High-performance Inline SVG Icons for Measurement Points (Zero Network Latency)
const pointIconA = L.divIcon({
    className: 'custom-measure-marker-a',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#ef4444;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.4);color:white;font-weight:900;font-size:12px;">A</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

const pointIconB = L.divIcon({
    className: 'custom-measure-marker-b',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#eab308;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.4);color:black;font-weight:900;font-size:12px;">B</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
});

export type MapLayerType = 'crystal' | 'google_hybrid';

export interface MapLayerConfig {
    id: MapLayerType;
    name: string;
    subName: string;
    url: string;
    attribution: string;
    maxZoom: number;
    maxNativeZoom: number;
    subdomains: string[];
}

export const MAP_LAYERS: Record<MapLayerType, MapLayerConfig> = {
    crystal: {
        id: 'crystal',
        name: "Crystal HD Satellite",
        subName: "ArcGIS World Imagery",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxZoom: 22,
        maxNativeZoom: 19,
        subdomains: ['a', 'b', 'c']
    },
    google_hybrid: {
        id: 'google_hybrid',
        name: "Google Hybrid",
        subName: "Satellite + Hindi/Eng Names",
        url: "https://{s}.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}",
        attribution: "Google Maps",
        maxZoom: 22,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }
};

const resolveLayer = (type?: string): MapLayerConfig => {
    if (type === 'google_hybrid' || type === 'hybrid' || type === 'streets' || type === 'terrain' || type === 'osm') {
        return MAP_LAYERS.google_hybrid;
    }
    return MAP_LAYERS.crystal;
};

interface LocationPickerMapProps {
    lat: number;
    lng: number;
    radius?: number;
    zoom?: number;
    onZoom?: (zoom: number) => void;
    onMove: (lat: number, lng: number) => void;
    isMeasuring?: boolean;
    measurePoints?: [number, number][];
    onMeasure?: (points: [number, number][], distance: number | null) => void;
    isMaximized?: boolean;
    mapType?: MapLayerType | string;
}

function MapUpdater({ lat, lng, zoom }: { lat: number, lng: number, zoom?: number }) {
    const map = useMap();
    const prevLatRef = useRef<number>(lat);
    const prevLngRef = useRef<number>(lng);
    const prevZoomRef = useRef<number | undefined>(zoom);

    useEffect(() => {
        try {
            if (!map || !map.getContainer()) return;
            const center = map.getCenter();
            if (!center) return;
            const currentZoom = map.getZoom();

            const latChanged = lat !== prevLatRef.current;
            const lngChanged = lng !== prevLngRef.current;
            const zoomPropChanged = zoom !== undefined && zoom !== prevZoomRef.current;

            prevLatRef.current = lat;
            prevLngRef.current = lng;
            if (zoom !== undefined) {
                prevZoomRef.current = zoom;
            }

            if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                const dist = Math.sqrt(Math.pow(center.lat - lat, 2) + Math.pow(center.lng - lng, 2));

                // Only update position if coordinates changed significantly from external source (> 50m)
                if ((latChanged || lngChanged) && dist > 0.0005) {
                    const targetZoom = zoomPropChanged ? (zoom || currentZoom) : currentZoom;
                    map.setView([lat, lng], targetZoom, { animate: false });
                } else if (zoomPropChanged && zoom !== currentZoom) {
                    map.setZoom(zoom);
                }
            }
        } catch (e) { }
    }, [lat, lng, zoom, map]);

    return null;
}

function MapResizer({ isMaximized }: { isMaximized: boolean }) {
    const map = useMap();

    useEffect(() => {
        const safeInvalidate = () => {
            try {
                if (map && map.getContainer()) {
                    map.invalidateSize({ animate: false });
                }
            } catch (e) { }
        };

        safeInvalidate();

        // Staggered fast invalidations to guarantee full tile grid coverage as modal/CSS settles
        const t1 = setTimeout(safeInvalidate, 30);
        const t2 = setTimeout(safeInvalidate, 100);
        const t3 = setTimeout(safeInvalidate, 250);
        const t4 = setTimeout(safeInvalidate, 500);

        // ResizeObserver to adapt smoothly whenever parent container size changes
        let resizeObserver: ResizeObserver | null = null;
        try {
            const container = map.getContainer();
            if (container && typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(() => {
                    safeInvalidate();
                });
                resizeObserver.observe(container);
            }
        } catch (e) { }

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            if (resizeObserver) resizeObserver.disconnect();
        };
    }, [isMaximized, map]);

    return null;
}

function MapEvents({ onMove, onZoom, isMeasuring }: {
    onMove: (lat: number, lng: number) => void;
    onZoom?: (zoom: number) => void;
    isMeasuring: boolean;
}) {
    useMapEvents({
        moveend: (e) => {
            try {
                if (!isMeasuring) {
                    const map = e.target;
                    if (map && map.getContainer()) {
                        const center = map.getCenter();
                        if (center && !isNaN(center.lat) && !isNaN(center.lng)) {
                            onMove(center.lat, center.lng);
                        }
                    }
                }
            } catch (e) { }
        },
        zoomend: (e) => {
            try {
                const map = e.target;
                if (map && map.getContainer() && onZoom) {
                    onZoom(map.getZoom());
                }
            } catch (e) { }
        }
    });
    return null;
}

function MeasureEvents({ isMeasuring, measurePoints = [], onMeasure }: {
    isMeasuring: boolean,
    measurePoints?: [number, number][],
    onMeasure: (points: [number, number][], distance: number | null) => void
}) {
    useMapEvents({
        click: (e) => {
            try {
                if (!isMeasuring) return;

                const safePoints = measurePoints || [];
                const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
                let newPoints: [number, number][] = [];

                if (safePoints.length >= 2 || safePoints.length === 0) {
                    newPoints = [newPoint];
                    onMeasure(newPoints, null);
                } else {
                    newPoints = [...safePoints, newPoint];
                    const p1 = L.latLng(newPoints[0]);
                    const p2 = L.latLng(newPoints[1]);
                    const distance = p1.distanceTo(p2);
                    onMeasure(newPoints, distance);
                }
            } catch (e) { }
        }
    });
    return null;
}

function MapZoomControls() {
    const map = useMap();
    return (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[1000] flex flex-col gap-1 shadow-md">
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try { map.zoomIn(); } catch (err) { }
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 bg-white/95 hover:bg-white active:scale-95 text-gray-800 font-black rounded-lg shadow border border-gray-200/90 flex items-center justify-center transition-all text-sm sm:text-base leading-none select-none hover:text-blue-600"
                title="Zoom In"
            >
                +
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try { map.zoomOut(); } catch (err) { }
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 bg-white/95 hover:bg-white active:scale-95 text-gray-800 font-black rounded-lg shadow border border-gray-200/90 flex items-center justify-center transition-all text-sm sm:text-base leading-none select-none hover:text-blue-600"
                title="Zoom Out"
            >
                −
            </button>
        </div>
    );
}

function LocationPickerMapComponent({
    lat,
    lng,
    radius = 100,
    zoom,
    onZoom,
    onMove,
    isMeasuring = false,
    measurePoints = [],
    onMeasure = () => { },
    isMaximized = false,
    mapType = 'crystal'
}: LocationPickerMapProps) {
    const isValidLat = typeof lat === 'number' && !isNaN(lat) && lat !== 0;
    const isValidLng = typeof lng === 'number' && !isNaN(lng) && lng !== 0;
    const displayLat = isValidLat ? lat : 23.245103;
    const displayLng = isValidLng ? lng : 77.506468;
    const initialZoom = zoom || (isValidLat && isValidLng ? 18 : 17);
    const activeLayer = resolveLayer(mapType);
    const safeMeasurePoints = measurePoints || [];

    return (
        <div className="relative w-full h-full min-h-[260px] sm:min-h-[360px] rounded-xl overflow-hidden shadow-inner border border-gray-200 group bg-slate-900">

            {/* --- Center Crosshair --- (Only show when not measuring) */}
            {!isMeasuring && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none drop-shadow-lg">
                    <svg className="w-10 h-10 text-red-600 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24" stroke="white" strokeWidth="1">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                </div>
            )}

            <MapContainer
                center={[displayLat, displayLng]}
                zoom={initialZoom}
                minZoom={3}
                maxZoom={activeLayer.maxZoom}
                preferCanvas={true}
                style={{ height: "100%", minHeight: "260px", width: "100%", background: "#0f172a" }}
                scrollWheelZoom={true}
                zoomControl={false}
            >
                <TileLayer
                    key={activeLayer.id}
                    url={activeLayer.url}
                    attribution={activeLayer.attribution}
                    maxNativeZoom={activeLayer.maxNativeZoom}
                    maxZoom={activeLayer.maxZoom}
                    subdomains={activeLayer.subdomains || ['a', 'b', 'c']}
                    keepBuffer={16}
                    updateWhenIdle={false}
                    updateWhenZooming={true}
                    updateInterval={30}
                    tileSize={256}
                    crossOrigin="anonymous"
                />

                {!isMeasuring && isValidLat && isValidLng ? (
                    <Circle
                        center={[displayLat, displayLng]}
                        radius={radius || 100}
                        pathOptions={{ color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.15, weight: 2, dashArray: '5, 10' }}
                    />
                ) : null}

                {/* Render Measurement Points and Line */}
                {isMeasuring && safeMeasurePoints.map((point, idx) => (
                    <Marker
                        key={idx}
                        position={point}
                        icon={idx === 0 ? pointIconA : pointIconB}
                    />
                ))}

                {isMeasuring && safeMeasurePoints.length === 2 && (
                    <Polyline
                        positions={safeMeasurePoints}
                        pathOptions={{
                            color: '#FF0000',
                            weight: 4,
                            dashArray: '10, 10',
                            lineCap: 'round',
                            className: 'running-measure-line'
                        }}
                    />
                )}

                {/* Always-on fallback styles with hardware acceleration for blazing fast rendering */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .leaflet-container {
                        background-color: #0f172a !important;
                        width: 100% !important;
                        height: 100% !important;
                        transform: translate3d(0, 0, 0);
                    }
                    .leaflet-tile-container img {
                        will-change: transform;
                        transform: translateZ(0);
                        image-rendering: -webkit-optimize-contrast;
                    }
                    @keyframes marching-ants-fallback {
                        0% { stroke-dashoffset: 20; }
                        100% { stroke-dashoffset: 0; }
                    }
                    @-webkit-keyframes marching-ants-fallback {
                        0% { stroke-dashoffset: 20; }
                        100% { stroke-dashoffset: 0; }
                    }
                    .running-measure-line {
                        -webkit-animation: marching-ants-fallback 0.7s linear infinite !important;
                        animation: marching-ants-fallback 0.7s linear infinite !important;
                        stroke-dasharray: 10, 10 !important;
                        stroke-linecap: round !important;
                        visibility: visible !important;
                    }
                `}} />

                <MapZoomControls />
                <MapUpdater lat={lat} lng={lng} zoom={zoom} />
                <MapResizer isMaximized={isMaximized} />
                <MapEvents onMove={onMove} onZoom={onZoom} isMeasuring={isMeasuring} />
                <MeasureEvents isMeasuring={isMeasuring} measurePoints={safeMeasurePoints} onMeasure={onMeasure} />
            </MapContainer>
        </div>
    );
}

export default memo(LocationPickerMapComponent);
