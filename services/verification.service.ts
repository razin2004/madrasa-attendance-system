import { prisma } from '@/lib/prisma';
import { calculateDistanceMeters, isWithinGeofence, GeofenceCheckResult } from '@/lib/geolocation';
import { hashDeviceSecret } from '@/lib/security';
import { DeviceStatus } from '@prisma/client';

export interface NetworkVerificationResult {
  isVerified: boolean;
  branchId: string;
  branchName: string;
  requestIp: string;
  registeredPrimaryIp: string | null;
  matchedIp?: string;
  failureReason?: string;
}

export interface LocationVerificationResult {
  isVerified: boolean;
  branchId: string;
  branchName: string;
  distanceMeters: number;
  allowedRadiusMeters: number;
  locationAccuracyMeters?: number;
  marginMeters: number;
  branchCoordinates: {
    latitude: number;
    longitude: number;
  };
  staffCoordinates: {
    latitude: number;
    longitude: number;
  };
  failureReason?: string;
}

export interface DeviceVerificationResult {
  isVerified: boolean;
  staffProfileId: string;
  deviceStatus: DeviceStatus;
  deviceLabel?: string | null;
  failureReason?: string;
}

/**
 * Layer 1 Foundation: Verify staff request public IP against branch registered network identity
 */
export async function verifyBranchNetwork(
  requestIp: string,
  branchId: string
): Promise<NetworkVerificationResult> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      networkIdentities: {
        where: { isActive: true },
      },
    },
  });

  if (!branch) {
    return {
      isVerified: false,
      branchId,
      branchName: 'Unknown Branch',
      requestIp,
      registeredPrimaryIp: null,
      failureReason: 'Branch not found.',
    };
  }

  if (branch.status !== 'ACTIVE') {
    return {
      isVerified: false,
      branchId: branch.id,
      branchName: branch.name,
      requestIp,
      registeredPrimaryIp: branch.publicIp,
      failureReason: 'Branch is currently inactive.',
    };
  }

  const cleanRequestIp = requestIp.trim();

  // Check 1: Primary registered IP on Branch model
  if (branch.publicIp && branch.publicIp.trim() === cleanRequestIp) {
    return {
      isVerified: true,
      branchId: branch.id,
      branchName: branch.name,
      requestIp: cleanRequestIp,
      registeredPrimaryIp: branch.publicIp,
      matchedIp: branch.publicIp,
    };
  }

  // Check 2: Active registered secondary network identities (up to 5 total)
  const matchedIdentity = branch.networkIdentities.find(
    (n) => n.publicIp.trim() === cleanRequestIp
  );

  if (matchedIdentity) {
    return {
      isVerified: true,
      branchId: branch.id,
      branchName: branch.name,
      requestIp: cleanRequestIp,
      registeredPrimaryIp: branch.publicIp,
      matchedIp: matchedIdentity.publicIp,
    };
  }

  return {
    isVerified: false,
    branchId: branch.id,
    branchName: branch.name,
    requestIp: cleanRequestIp,
    registeredPrimaryIp: branch.publicIp,
    failureReason: 'Public network IP does not match any registered branch network identity.',
  };
}

/**
 * Layer 2 Foundation: Verify staff physical coordinates against branch geofence radius
 */
export async function verifyBranchLocation(
  staffLat: number,
  staffLng: number,
  branchId: string,
  staffAccuracyMeters?: number
): Promise<LocationVerificationResult> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
  });

  if (!branch || branch.latitude === null || branch.longitude === null) {
    return {
      isVerified: false,
      branchId,
      branchName: branch?.name || 'Unknown Branch',
      distanceMeters: -1,
      allowedRadiusMeters: branch?.geofenceRadiusMeters || 150,
      marginMeters: 0,
      branchCoordinates: { latitude: 0, longitude: 0 },
      staffCoordinates: { latitude: staffLat, longitude: staffLng },
      failureReason: 'Branch location coordinates have not been configured.',
    };
  }

  if (branch.status !== 'ACTIVE') {
    return {
      isVerified: false,
      branchId: branch.id,
      branchName: branch.name,
      distanceMeters: -1,
      allowedRadiusMeters: branch.geofenceRadiusMeters,
      marginMeters: 0,
      branchCoordinates: { latitude: branch.latitude, longitude: branch.longitude },
      staffCoordinates: { latitude: staffLat, longitude: staffLng },
      failureReason: 'Branch is currently inactive.',
    };
  }

  const check = isWithinGeofence(
    staffLat,
    staffLng,
    branch.latitude,
    branch.longitude,
    branch.geofenceRadiusMeters,
    staffAccuracyMeters
  );

  return {
    isVerified: check.isWithin,
    branchId: branch.id,
    branchName: branch.name,
    distanceMeters: check.distanceMeters,
    allowedRadiusMeters: branch.geofenceRadiusMeters,
    locationAccuracyMeters: staffAccuracyMeters,
    marginMeters: check.marginMeters,
    branchCoordinates: {
      latitude: branch.latitude,
      longitude: branch.longitude,
    },
    staffCoordinates: {
      latitude: staffLat,
      longitude: staffLng,
    },
    failureReason: check.isWithin
      ? undefined
      : check.failureReason || `Location is ${check.distanceMeters}m from branch (exceeds ${branch.geofenceRadiusMeters}m geofence radius).`,
  };
}

/**
 * Layer 3 Foundation: Verify staff device secret against registered device hash (Multi-Device Match)
 */
export async function verifyStaffDevice(
  staffProfileId: string,
  rawDeviceSecret: string
): Promise<DeviceVerificationResult> {
  const devices = await prisma.staffDevice.findMany({
    where: { staffProfileId },
  });

  if (devices.length === 0) {
    return {
      isVerified: false,
      staffProfileId,
      deviceStatus: 'NOT_REGISTERED',
      failureReason: 'No registered device found for this staff member.',
    };
  }

  const registeredDevices = devices.filter(
    (d) => d.status === 'REGISTERED' && d.secretHash
  );

  if (registeredDevices.length === 0) {
    const isResetReq = devices.some((d) => d.status === 'RESET_REQUIRED');
    return {
      isVerified: false,
      staffProfileId,
      deviceStatus: isResetReq ? 'RESET_REQUIRED' : 'NOT_REGISTERED',
      failureReason: isResetReq
        ? 'Device registration was reset by administrator. Re-registration required.'
        : 'Device is not currently registered.',
    };
  }

  if (!rawDeviceSecret || !rawDeviceSecret.trim()) {
    return {
      isVerified: false,
      staffProfileId,
      deviceStatus: 'REGISTERED',
      failureReason: 'Device credential missing from request.',
    };
  }

  const incomingSecretHash = hashDeviceSecret(rawDeviceSecret.trim());

  const matchedDevice = registeredDevices.find(
    (d) => d.secretHash === incomingSecretHash
  );

  if (!matchedDevice) {
    return {
      isVerified: false,
      staffProfileId,
      deviceStatus: 'REGISTERED',
      failureReason: 'Current device is not registered for this staff account.',
    };
  }

  // Update lastUsedAt asynchronously
  prisma.staffDevice
    .update({
      where: { id: matchedDevice.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    isVerified: true,
    staffProfileId,
    deviceStatus: 'REGISTERED',
    deviceLabel: matchedDevice.label,
  };
}
