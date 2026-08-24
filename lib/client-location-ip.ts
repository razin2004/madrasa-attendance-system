/**
 * Client-side High-Accuracy Geolocation & Public IP Helper
 */

export interface ClientLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Fetch client's WAN Public IP with timeout fallback
 */
export async function getClientPublicIp(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return data.ip.trim();
      }
    }
  } catch {
    // Graceful fallback to server header extraction
  }
  return null;
}

/**
 * Request High-Accuracy GPS Location from Browser
 */
export function getHighAccuracyLocation(): Promise<ClientLocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 10,
        });
      },
      (err) => {
        let msg = 'Failed to obtain location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location access was denied. Please allow location permissions in your browser settings to verify geofence.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable. Ensure GPS is enabled on your device.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Retrying with default precision...';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  });
}
