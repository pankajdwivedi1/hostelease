import { MapContainer, TileLayer, useMapEvents, useMap, Circle, Marker, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";

// Fix for default markers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons for Measurement Points
const pointIconA = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const pointIconB = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface LocationPickerMapProps {
    lat: number;
    lng: number;
    radius?: number;
    zoom?: number;
    onMove: (lat: number, lng: number) => void;
    isMeasuring?: boolean;
    measurePoints?: [number, number][];
    onMeasure?: (points: [number, number][], distance: number | null) => void;
    isMaximized?: boolean;
}

function MapUpdater({ lat, lng, zoom }: { lat: number, lng: number, zoom?: number }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            const center = map.getCenter();
            const dist = Math.sqrt(Math.pow(center.lat - lat, 2) + Math.pow(center.lng - lng, 2));
            if (dist > 0.00001) {
                const targetZoom = zoom || map.getZoom();
                map.flyTo([lat, lng], targetZoom, { duration: 0.5 });
            }
        }
    }, [lat, lng, zoom, map]);
    return null;
}

function MapResizer({ isMaximized }: { isMaximized: boolean }) {
    const map = useMap();
    useEffect(() => {
        // Trigger a size recalculation when the container size changes
        // Use a small delay to allow the CSS transition (300ms) to finish
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 350);

        // Also trigger immediately for snappier feel
        map.invalidateSize();

        return () => clearTimeout(timer);
    }, [isMaximized, map]);
    return null;
}

function MapEvents({ onMove, isMeasuring }: { onMove: (lat: number, lng: number) => void, isMeasuring: boolean }) {
    const map = useMapEvents({
        moveend: () => {
            if (!isMeasuring) {
                const center = map.getCenter();
                onMove(center.lat, center.lng);
            }
        },
    });
    return null;
}

function MeasureEvents({ isMeasuring, measurePoints, onMeasure }: {
    isMeasuring: boolean,
    measurePoints: [number, number][],
    onMeasure: (points: [number, number][], distance: number | null) => void
}) {
    useMapEvents({
        click: (e) => {
            if (!isMeasuring) return;

            const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
            let newPoints: [number, number][] = [];

            if (measurePoints.length >= 2 || measurePoints.length === 0) {
                newPoints = [newPoint];
                onMeasure(newPoints, null);
            } else {
                newPoints = [...measurePoints, newPoint];
                const p1 = L.latLng(newPoints[0]);
                const p2 = L.latLng(newPoints[1]);
                const distance = p1.distanceTo(p2);
                onMeasure(newPoints, distance);
            }
        }
    });
    return null;
}

export default function LocationPickerMap({
    lat,
    lng,
    radius = 100,
    zoom,
    onMove,
    isMeasuring = false,
    measurePoints = [],
    onMeasure = () => { },
    isMaximized = false
}: LocationPickerMapProps) {
    const displayLat = lat || 23.245103;
    const displayLng = lng || 77.506468;
    const initialZoom = zoom || (lat && lng ? 18 : 17);

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-gray-200 group">

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
                maxZoom={22}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
                zoomControl={false}
            >
                <TileLayer
                    url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
                    attribution="Google"
                    maxNativeZoom={19}
                    maxZoom={22}
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                />

                {!isMeasuring && lat && lng ? (
                    <Circle
                        center={[lat, lng]}
                        radius={radius}
                        pathOptions={{ color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.15, weight: 2, dashArray: '5, 10' }}
                    />
                ) : null}

                {/* Render Measurement Points and Line */}
                {isMeasuring && measurePoints.map((point, idx) => (
                    <Marker
                        key={idx}
                        position={point}
                        icon={idx === 0 ? pointIconA : pointIconB}
                    />
                ))}

                {isMeasuring && measurePoints.length === 2 && (
                    <Polyline
                        positions={measurePoints}
                        pathOptions={{
                            color: '#FF0000',
                            weight: 4,
                            dashArray: '10, 10',
                            lineCap: 'round',
                            className: 'running-measure-line'
                        }}
                    />
                )}

                {/* Always-on fallback styles to prevent production build pruning */}
                <style dangerouslySetInnerHTML={{
                    __html: `
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

                <MapUpdater lat={lat} lng={lng} zoom={zoom} />
                <MapResizer isMaximized={isMaximized} />
                <MapEvents onMove={onMove} isMeasuring={isMeasuring} />
                <MeasureEvents isMeasuring={isMeasuring} measurePoints={measurePoints} onMeasure={onMeasure} />
            </MapContainer>
        </div>
    );
}
