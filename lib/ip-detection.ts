/**
 * Server-side Public IP Extraction and Normalization
 */

export function extractClientPublicIp(request: Request | Headers): string {
  const headers = request instanceof Request ? request.headers : request;

  // Server-Authoritative Header Priority (Section 8):
  // 1. Cloudflare / Edge Provider header
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cleanIp(cfConnectingIp);
  }

  // 2. Standard X-Real-IP
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp && xRealIp.trim()) {
    return cleanIp(xRealIp);
  }

  // 3. X-Forwarded-For (Proxy Chain: client, proxy1, proxy2)
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor && xForwardedFor.trim()) {
    const ips = xForwardedFor.split(',');
    const clientIp = ips[0].trim();
    if (clientIp) {
      return cleanIp(clientIp);
    }
  }

  // 4. Fallback
  return '127.0.0.1';
}

function cleanIp(rawIp: string): string {
  let ip = rawIp.trim();

  // If port is attached (e.g. 192.168.1.1:8080)
  if (ip.includes(':') && !ip.includes('::') && ip.split(':').length === 2) {
    ip = ip.split(':')[0];
  }

  // Normalize IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  return ip;
}

/**
 * Validate public IP address (Section 25):
 * Rejects localhost (127.0.0.1, ::1) and private LAN ranges:
 * - 10.0.0.0 – 10.255.255.255
 * - 172.16.0.0 – 172.31.255.255
 * - 192.168.0.0 – 192.168.255.255
 */
export function isValidPublicIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const clean = ip.trim();

  // IPv6 Support
  if (clean.includes(':')) {
    if (clean === '::1' || clean === '::ffff:127.0.0.1') return false;
    // Exclude IPv6 Link-Local (fe80::/10) and Unique Local (fd00::/8, fc00::/7)
    const lower = clean.toLowerCase();
    if (lower.startsWith('fe80:') || lower.startsWith('fd') || lower.startsWith('fc')) return false;
    // Valid public IPv6 format check
    return /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$/.test(clean) || /^[0-9a-fA-F:]+$/.test(clean);
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = clean.match(ipv4Regex);
  if (!match) return false;

  const octets = match.slice(1, 5).map(Number);
  if (octets.some((o) => o < 0 || o > 255)) return false;

  // Localhost
  if (octets[0] === 127 || octets[0] === 0) return false;

  // Private 10.x.x.x
  if (octets[0] === 10) return false;

  // Private 172.16.x.x – 172.31.x.x
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;

  // Private 192.168.x.x
  if (octets[0] === 192 && octets[1] === 168) return false;

  return true;
}
