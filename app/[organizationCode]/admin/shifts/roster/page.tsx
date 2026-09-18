'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ShiftRosterRedirectPage() {
  const params = useParams();
  const organizationCode = (params.organizationCode as string)?.toUpperCase();
  const router = useRouter();

  useEffect(() => {
    if (organizationCode) {
      router.replace(`/${organizationCode}/admin/roster`);
    }
  }, [organizationCode, router]);

  return null;
}
