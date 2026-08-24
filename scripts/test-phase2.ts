import fs from 'fs';
import path from 'path';

// 1. Load .env FIRST before initializing PrismaClient
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

import { calculateDistanceMeters, isWithinGeofence, isValidCoordinate } from '../lib/geolocation';
import { extractClientPublicIp } from '../lib/ip-detection';
import { verifyBranchNetwork, verifyBranchLocation } from '../services/verification.service';
import { recordAuditLog } from '../services/audit.service';

async function runPhase2Verification() {
  console.log('================================================================');
  console.log('SHIFTGUARD — PHASE 2 AUTOMATED VERIFICATION SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${label}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Haversine Geospatial Distance Calculation & Geofence Checks
    // -------------------------------------------------------------------------
    console.log('\n[1/7] Testing Geospatial Calculation & Geofence Boundary Engine');

    // Identical coords
    const distZero = calculateDistanceMeters(40.758, -73.9855, 40.758, -73.9855);
    assert(distZero === 0, 'Distance between identical points is 0 meters');

    // Known reference: Times Square (40.7580, -73.9855) to Empire State Building (40.7484, -73.9857) ~ 1068m
    const distNYC = calculateDistanceMeters(40.758, -73.9855, 40.7484, -73.9857);
    assert(distNYC >= 1000 && distNYC <= 1150, `Distance NYC Times Square -> Empire State: ${distNYC}m (expected ~1068m)`);

    // Coordinate validation
    assert(isValidCoordinate(40.758, -73.9855) === true, 'Valid coordinates pass validation');
    assert(isValidCoordinate(95.0, -73.9855) === false, 'Invalid latitude (>90) rejected');
    assert(isValidCoordinate(40.758, -190.0) === false, 'Invalid longitude (<-180) rejected');

    // Geofence Evaluation: Inside vs Outside
    // Staff 50m away with 150m radius -> INSIDE
    const branchLat = 12.9716;
    const branchLng = 77.5946;
    // Small delta ~ 0.0004 deg lat is ~44 meters
    const staffInsideLat = 12.972;
    const staffInsideLng = 77.5946;
    const insideCheck = isWithinGeofence(staffInsideLat, staffInsideLng, branchLat, branchLng, 150);
    assert(insideCheck.isWithin === true, `Staff inside geofence verified: ${insideCheck.distanceMeters}m <= 150m`);

    // Staff 1000m away -> OUTSIDE
    const staffFarLat = 12.9806;
    const staffFarLng = 77.5946;
    const outsideCheck = isWithinGeofence(staffFarLat, staffFarLng, branchLat, branchLng, 150);
    assert(outsideCheck.isWithin === false, `Staff outside geofence verified: ${outsideCheck.distanceMeters}m > 150m`);

    // -------------------------------------------------------------------------
    // TEST 2: Server-Side IP Detection Logic
    // -------------------------------------------------------------------------
    console.log('\n[2/7] Testing Server-Side Public IP Resolution');

    const headersWithCF = new Headers({ 'cf-connecting-ip': '203.0.113.45' });
    assert(extractClientPublicIp(headersWithCF) === '203.0.113.45', 'Resolves CF-Connecting-IP correctly');

    const headersWithXForwarded = new Headers({ 'x-forwarded-for': '198.51.100.12, 10.0.0.1, 127.0.0.1' });
    assert(extractClientPublicIp(headersWithXForwarded) === '198.51.100.12', 'Resolves leftmost IP from X-Forwarded-For proxy chain');

    const headersWithPort = new Headers({ 'x-real-ip': '198.51.100.99:8080' });
    assert(extractClientPublicIp(headersWithPort) === '198.51.100.99', 'Strips port number from client IP');

    // -------------------------------------------------------------------------
    // TEST 3: Multi-Tenant Organizations & Branch Provisioning
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Testing Multi-Tenant Organizations & Branch Registration');

    const timestamp = Date.now();
    const testOrgCodeA = `ORGA${Math.floor(10 + Math.random() * 90)}`;
    const testOrgCodeB = `ORGB${Math.floor(10 + Math.random() * 90)}`;

    const orgA = await prisma.organization.create({
      data: {
        organizationCode: testOrgCodeA,
        name: `Organization Alpha ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    const orgB = await prisma.organization.create({
      data: {
        organizationCode: testOrgCodeB,
        name: `Organization Beta ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    // Create Branch under Org A
    const branchA = await prisma.branch.create({
      data: {
        organizationId: orgA.id,
        name: 'Downtown Medical Branch',
        address: '100 Main Street, Suite 400',
        latitude: 12.9716,
        longitude: 77.5946,
        locationAccuracyMeters: 8.5,
        geofenceRadiusMeters: 150, // Default 150m
        publicIp: '203.0.113.10',
        ipSource: 'CAPTURED',
        ipCapturedAt: new Date(),
        ipCapturedBy: 'Admin Alpha',
        locationCapturedAt: new Date(),
        locationCapturedBy: 'Admin Alpha',
        status: 'ACTIVE',
        networkIdentities: {
          create: {
            publicIp: '203.0.113.10',
            source: 'CAPTURED',
            capturedBy: 'Admin Alpha',
            isActive: true,
          },
        },
      },
      include: {
        networkIdentities: true,
      },
    });

    assert(branchA.organizationId === orgA.id, 'Branch A bound strictly to Organization A');
    assert(branchA.geofenceRadiusMeters === 150, 'Default geofence radius is 150 meters');
    assert(branchA.publicIp === '203.0.113.10', 'Primary public IP stored on Branch record');
    assert(branchA.networkIdentities.length === 1, 'BranchNetworkIdentity record created');

    // -------------------------------------------------------------------------
    // TEST 4: Strict Cross-Tenant Isolation
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Verifying Strict Multi-Tenant Isolation');

    // Query branches for Org B
    const orgBBranches = await prisma.branch.findMany({
      where: { organizationId: orgB.id },
    });
    assert(orgBBranches.length === 0, 'Org B cannot view Org A branches (isolation check)');

    // Attempting to access Branch A with Org B filter yields null
    const crossTenantBranch = await prisma.branch.findFirst({
      where: {
        id: branchA.id,
        organizationId: orgB.id,
      },
    });
    assert(crossTenantBranch === null, 'Cross-tenant lookup with mismatched organizationId is blocked');

    // -------------------------------------------------------------------------
    // TEST 5: Branch Metadata Update & Geofence Radius Modification
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Testing Branch Metadata Update & Geofence Radius Configuration');

    const updatedBranch = await prisma.branch.update({
      where: { id: branchA.id },
      data: {
        name: 'Downtown Medical Center & Clinic',
        address: '100 Main Street, Suite 450',
        geofenceRadiusMeters: 250, // Updated radius
      },
    });

    assert(updatedBranch.name === 'Downtown Medical Center & Clinic', 'Branch name updated');
    assert(updatedBranch.geofenceRadiusMeters === 250, 'Geofence radius updated to 250 meters');

    // Audit log
    await recordAuditLog({
      organizationId: orgA.id,
      action: 'GEOFENCE_RADIUS_CHANGED',
      entityType: 'Branch',
      entityId: branchA.id,
      metadata: { oldRadius: 150, newRadius: 250 },
    });

    // -------------------------------------------------------------------------
    // TEST 6: Network IP Re-capture & Manual Override Workflows
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Testing IP Re-capture, Manual Override & Location Re-capture');

    // Re-capture IP
    const recapturedIp = '203.0.113.99';
    const recapturedBranch = await prisma.branch.update({
      where: { id: branchA.id },
      data: {
        publicIp: recapturedIp,
        ipSource: 'CAPTURED',
        ipCapturedAt: new Date(),
        ipCapturedBy: 'Admin Alpha',
        networkIdentities: {
          create: {
            publicIp: recapturedIp,
            source: 'CAPTURED',
            capturedBy: 'Admin Alpha',
            isActive: true,
          },
        },
      },
    });
    assert(recapturedBranch.publicIp === recapturedIp, `IP Re-capture updated primary IP: ${recapturedIp}`);
    assert(recapturedBranch.ipSource === 'CAPTURED', 'IP source set to CAPTURED');

    // Manual Override
    const manualIp = '198.51.100.88';
    const manualReason = 'ISP dynamic CGNAT pool configuration verified';
    const overriddenBranch = await prisma.branch.update({
      where: { id: branchA.id },
      data: {
        publicIp: manualIp,
        ipSource: 'MANUAL_OVERRIDE',
        ipCapturedAt: new Date(),
        ipCapturedBy: 'Admin Alpha',
        networkIdentities: {
          create: {
            publicIp: manualIp,
            source: 'MANUAL_OVERRIDE',
            overrideReason: manualReason,
            capturedBy: 'Admin Alpha',
            isActive: true,
          },
        },
      },
    });
    assert(overriddenBranch.publicIp === manualIp, `Manual IP Override applied: ${manualIp}`);
    assert(overriddenBranch.ipSource === 'MANUAL_OVERRIDE', 'IP source set to MANUAL_OVERRIDE');

    // Location Re-capture
    const newLat = 12.9725;
    const newLng = 77.5950;
    const relocatedBranch = await prisma.branch.update({
      where: { id: branchA.id },
      data: {
        latitude: newLat,
        longitude: newLng,
        locationAccuracyMeters: 6.0,
        locationCapturedAt: new Date(),
        locationCapturedBy: 'Admin Alpha',
      },
    });
    assert(relocatedBranch.latitude === newLat && relocatedBranch.longitude === newLng, 'Location re-captured successfully');

    // Branch Activation / Deactivation Lifecycle
    const deactivatedBranch = await prisma.branch.update({
      where: { id: branchA.id },
      data: { status: 'INACTIVE' },
    });
    assert(deactivatedBranch.status === 'INACTIVE', 'Branch transitioned to INACTIVE');

    const reactivatedBranch = await prisma.branch.update({
      where: { id: branchA.id },
      data: { status: 'ACTIVE' },
    });
    assert(reactivatedBranch.status === 'ACTIVE', 'Branch reactivated to ACTIVE');

    // -------------------------------------------------------------------------
    // TEST 7: Reusable Verification Service Foundation (Phase 5 Ready)
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Testing Reusable Verification Service Foundation (Phase 5 Integration)');

    // Network Verification
    const networkSuccess = await verifyBranchNetwork(manualIp, branchA.id);
    assert(networkSuccess.isVerified === true, `Network verification succeeded for registered IP: ${manualIp}`);

    const networkFail = await verifyBranchNetwork('1.2.3.4', branchA.id);
    assert(networkFail.isVerified === false, 'Network verification rejected unauthorized IP (1.2.3.4)');

    // Location Verification
    // Coords within 250m geofence -> Verified
    const locSuccess = await verifyBranchLocation(newLat, newLng, branchA.id);
    assert(locSuccess.isVerified === true, `Location verification succeeded at branch coords (distance: ${locSuccess.distanceMeters}m)`);

    // Far coords (5km away) -> Rejected
    const locFail = await verifyBranchLocation(13.0100, 77.5950, branchA.id);
    assert(locFail.isVerified === false, `Location verification rejected outside geofence (distance: ${locFail.distanceMeters}m)`);

    // Inactive Branch Verification
    await prisma.branch.update({ where: { id: branchA.id }, data: { status: 'INACTIVE' } });
    const inactiveNetCheck = await verifyBranchNetwork(manualIp, branchA.id);
    const inactiveLocCheck = await verifyBranchLocation(newLat, newLng, branchA.id);
    assert(inactiveNetCheck.isVerified === false, 'Inactive branch automatically rejected in network check');
    assert(inactiveLocCheck.isVerified === false, 'Inactive branch automatically rejected in location check');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await prisma.branchNetworkIdentity.deleteMany({ where: { branchId: branchA.id } }).catch(() => {});
    await prisma.branch.delete({ where: { id: branchA.id } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } }).catch(() => {});

    console.log('\n================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    process.exit(failed === 0 ? 0 : 1);
  } catch (error: any) {
    console.error('Fatal verification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase2Verification();
