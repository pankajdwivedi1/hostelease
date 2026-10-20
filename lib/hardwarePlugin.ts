import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeWifiInfo {
    isConnected: boolean;
    bssid: string;
    ssid: string;
    rssi: number;
    frequency?: number;
    band?: string;
    hasPermission: boolean;
    error?: string;
}

export interface NativeGpsLocation {
    success: boolean;
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    speed?: number;
    time?: number;
    provider?: string;
    isMock: boolean;
    gpsEnabled?: boolean;
    networkEnabled?: boolean;
    error?: string;
    code?: string;
}

export interface NativeHardwareAttendanceData {
    success: boolean;
    wifi?: {
        bssid: string;
        ssid: string;
        rssi: number;
        isConnected: boolean;
    };
    gps?: {
        latitude: number;
        longitude: number;
        accuracy: number;
        isMock: boolean;
        provider: string;
        success: boolean;
    };
    device?: {
        isRooted: boolean;
        model: string;
        manufacturer: string;
        androidVersion: string;
        sdkInt: number;
    };
}

export interface HostelHardwarePluginInterface {
    getWifiInfo(): Promise<NativeWifiInfo>;
    getGpsLocation(): Promise<NativeGpsLocation>;
    getHardwareAttendanceData(): Promise<NativeHardwareAttendanceData>;
    isDeviceRooted(): Promise<{ isRooted: boolean }>;
}

// Register the native Android plugin
const HostelHardware = registerPlugin<HostelHardwarePluginInterface>('HostelHardware');

/**
 * Check if the app is currently running inside the native Android APK
 */
export function isAndroidNativeApp(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * ⚡ Read physical Wi-Fi Router BSSID and Signal Strength
 * On Android Native: Queries phone's physical Wi-Fi radio via native WifiManager
 * On Web / iPhone: Returns graceful fallback
 */
export async function getHardwareWifiInfo(): Promise<NativeWifiInfo> {
    if (isAndroidNativeApp()) {
        try {
            return await HostelHardware.getWifiInfo();
        } catch (e: any) {
            console.warn('⚠️ [HostelHardware] Native getWifiInfo error:', e?.message || e);
            return {
                isConnected: false,
                bssid: '',
                ssid: '',
                rssi: 0,
                hasPermission: false,
                error: e?.message || 'Native Wi-Fi read failed'
            };
        }
    }

    // Web / iOS Fallback
    return {
        isConnected: false,
        bssid: '',
        ssid: '',
        rssi: 0,
        hasPermission: true
    };
}

/**
 * ⚡ Read high-accuracy GPS coordinates directly from physical satellite hardware
 * On Android Native: Queries LocationManager + inspects Anti-Mock / Fake GPS flags
 * On Web / iPhone: Graceful fallback to browser navigator.geolocation
 */
export async function getHardwareGpsLocation(): Promise<NativeGpsLocation> {
    if (isAndroidNativeApp()) {
        try {
            const loc = await HostelHardware.getGpsLocation();
            if (loc && loc.success) {
                return loc;
            }
            if (loc && loc.error) {
                console.warn('⚠️ [HostelHardware] Native GPS warning:', loc.error);
            }
        } catch (e: any) {
            console.warn('⚠️ [HostelHardware] Native getGpsLocation error:', e?.message || e);
        }
    }

    // Standard Browser / Web Fallback
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            resolve({
                success: false,
                latitude: 0,
                longitude: 0,
                accuracy: 999,
                isMock: false,
                error: 'Geolocation is not supported by this browser.'
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    success: true,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    altitude: pos.coords.altitude || 0,
                    speed: pos.coords.speed || 0,
                    time: pos.timestamp,
                    provider: 'web-geolocation',
                    isMock: false // Web does not expose mock location directly
                });
            },
            (err) => {
                resolve({
                    success: false,
                    latitude: 0,
                    longitude: 0,
                    accuracy: 999,
                    isMock: false,
                    error: err.message || 'Failed to acquire location'
                });
            },
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 15000
            }
        );
    });
}

/**
 * ⚡ 1-Call Combined Hardware Attendance Verification
 * Synchronously grabs Wi-Fi BSSID, GPS, Anti-Mock flags, and device integrity
 */
export async function getHardwareAttendanceData(): Promise<NativeHardwareAttendanceData> {
    if (isAndroidNativeApp()) {
        try {
            return await HostelHardware.getHardwareAttendanceData();
        } catch (e: any) {
            console.warn('⚠️ [HostelHardware] Atomic hardware data error:', e?.message || e);
        }
    }

    // Web Fallback
    const gps = await getHardwareGpsLocation();
    return {
        success: gps.success,
        wifi: {
            bssid: '',
            ssid: '',
            rssi: 0,
            isConnected: false
        },
        gps: {
            latitude: gps.latitude,
            longitude: gps.longitude,
            accuracy: gps.accuracy,
            isMock: false,
            provider: gps.provider || 'web',
            success: gps.success
        },
        device: {
            isRooted: false,
            model: 'Web Browser',
            manufacturer: 'Standard',
            androidVersion: 'Web',
            sdkInt: 0
        }
    };
}

export default HostelHardware;
