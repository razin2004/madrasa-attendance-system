import { PrismaClient } from '@prisma/client';
import { calculateDistanceMeters, isWithinGeofence } from '@/lib/geolocation';

const prisma = new PrismaClient();

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}`);
    throw new Error(`Test assertion failed: ${testName}`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function main() {
  console.log('================================================================');
  console.log('ShiftGuard Geofence & Attendance Verification Audit Test Suite');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // SECTION 28: GEOFENCE BOUNDARY DISTANCE TESTS
  // ---------------------------------------------------------------------------
  console.log('1. Testing Geofence Boundary Distances (Radius = 150m)...');
  
  const branchLat = 10.000000;
  const branchLng = 76.000000;
  const radius = 150;

  // Exact spherical latitude offset calculation: meters -> degrees
  const offsetDeg = (meters: number) => (meters / 6371000) * (180 / Math.PI);

  // Case A: radius - 2m (148m)
  const lat148 = branchLat + offsetDeg(148);
  const check148 = isWithinGeofence(lat148, branchLng, branchLat, branchLng, radius);
  assert(check148.isWithin === true && check148.distanceMeters === 148, `radius - 2m (${check148.distanceMeters}m <= 150m) -> PASS`);

  // Case B: radius - 0.1m (149.9m)
  const lat149_9 = branchLat + offsetDeg(149.9);
  const check149_9 = isWithinGeofence(lat149_9, branchLng, branchLat, branchLng, radius);
  assert(check149_9.isWithin === true && check149_9.distanceMeters === 149.9, `radius - 0.1m (${check149_9.distanceMeters}m <= 150m) -> PASS`);

  // Case C: Exact radius (150m)
  const lat150 = branchLat + offsetDeg(150);
  const checkExact = isWithinGeofence(lat150, branchLng, branchLat, branchLng, radius);
  assert(checkExact.isWithin === true && checkExact.distanceMeters === 150, `Exact radius (${checkExact.distanceMeters}m <= 150m) -> PASS`);

  // Case D: radius + 0.1m (150.1m)
  const lat150_1 = branchLat + offsetDeg(150.1);
  const check150_1 = isWithinGeofence(lat150_1, branchLng, branchLat, branchLng, radius);
  assert(check150_1.isWithin === false && check150_1.distanceMeters === 150.1, `radius + 0.1m (${check150_1.distanceMeters}m > 150m) -> FAIL`);

  // Case E: radius + 2m (152m)
  const lat152 = branchLat + offsetDeg(152);
  const check152 = isWithinGeofence(lat152, branchLng, branchLat, branchLng, radius);
  assert(check152.isWithin === false && check152.distanceMeters === 152, `radius + 2m (${check152.distanceMeters}m > 150m) -> FAIL`);

  // Case F: 248m distance check (Section 31 example)
  const lat248 = branchLat + offsetDeg(248);
  const check248 = isWithinGeofence(lat248, branchLng, branchLat, branchLng, radius);
  assert(check248.isWithin === false && check248.distanceMeters === 248, `248m from branch (radius = 150m) -> FAIL`);

  console.log('\n2. Testing Haversine Distance Formula Accuracy...');
  const distZero = calculateDistanceMeters(10.0, 76.0, 10.0, 76.0);
  assert(distZero === 0, 'Same coordinates return 0 meters distance');

  const lat1000 = branchLat + offsetDeg(1000);
  const distKm = calculateDistanceMeters(lat1000, branchLng, branchLat, branchLng);
  assert(distKm === 1000, `Calculated exact 1000 meters (${distKm}m) distance`);

  console.log('\n================================================================');
  console.log('Geofence Audit Test Suite Completed: ALL PASSED.');
  console.log('================================================================');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
