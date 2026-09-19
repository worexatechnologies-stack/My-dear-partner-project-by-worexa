'use client';

import { getInterests } from '@/legacy/services/dataService';
import { fetchPassedProfilesFromBackend, getLocalPassedProfiles } from '@/lib/discover-actions';

export interface InterestStats {
  received: number;
  accepted: number;
  sent: number;
  declined: number;
}

export async function fetchInterestStats(): Promise<InterestStats> {
  try {
    const [incoming, sent, passedList] = await Promise.all([
      getInterests('incoming').catch(() => [] as any[]),
      getInterests('outgoing').catch(() => [] as any[]),
      fetchPassedProfilesFromBackend().catch(() => getLocalPassedProfiles()),
    ]);

    const incomingItems: any[] = (incoming || []).map((item: any) => ({
      ...item,
      direction: 'incoming',
    }));
    const sentItems: any[] = (sent || []).map((item: any) => ({
      ...item,
      direction: 'outgoing',
    }));

    // 1. Accepted Matches: deduplicated by partner ID
    const acceptedPartnerIds = new Set<string>();
    let acceptedCount = 0;
    for (const item of [...incomingItems, ...sentItems]) {
      if (item.status === 'ACCEPTED') {
        const partner = item.direction === 'incoming' ? item.sender : item.receiver;
        const partnerId = String(partner?.id || partner?.user_id || '');
        if (partnerId && !acceptedPartnerIds.has(partnerId)) {
          acceptedPartnerIds.add(partnerId);
          acceptedCount++;
        }
      }
    }

    // 2. Sent Likes: strictly PENDING outgoing, partner NOT already accepted
    const sentPartnerIds = new Set<string>();
    let sentCount = 0;
    for (const item of sentItems) {
      if (item.status === 'PENDING') {
        const partner = item.receiver;
        const partnerId = String(partner?.id || partner?.user_id || '');
        if (partnerId && !acceptedPartnerIds.has(partnerId) && !sentPartnerIds.has(partnerId)) {
          sentPartnerIds.add(partnerId);
          sentCount++;
        }
      }
    }

    // 3. Received Likes: strictly PENDING incoming, partner NOT already accepted
    const receivedPartnerIds = new Set<string>();
    let receivedCount = 0;
    for (const item of incomingItems) {
      if (item.status === 'PENDING') {
        const partner = item.sender;
        const partnerId = String(partner?.id || partner?.user_id || '');
        if (partnerId && !acceptedPartnerIds.has(partnerId) && !receivedPartnerIds.has(partnerId)) {
          receivedPartnerIds.add(partnerId);
          receivedCount++;
        }
      }
    }

    // 4. Passed & Declined: mutually exclusive
    const passedPartnerIds = new Set<string>();
    let declinedCount = 0;

    for (const item of incomingItems) {
      if (item.status === 'DECLINED') {
        const partner = item.sender;
        const partnerId = String(partner?.id || partner?.user_id || '');
        if (partnerId && !acceptedPartnerIds.has(partnerId) && !sentPartnerIds.has(partnerId) && !passedPartnerIds.has(partnerId)) {
          passedPartnerIds.add(partnerId);
          declinedCount++;
        }
      }
    }

    for (const p of passedList || []) {
      const pId = String(p.id);
      if (pId && !acceptedPartnerIds.has(pId) && !sentPartnerIds.has(pId) && !passedPartnerIds.has(pId)) {
        passedPartnerIds.add(pId);
        declinedCount++;
      }
    }

    return { received: receivedCount, accepted: acceptedCount, sent: sentCount, declined: declinedCount };
  } catch {
    return { received: 0, accepted: 0, sent: 0, declined: 0 };
  }
}
