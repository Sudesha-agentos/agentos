/** In-memory dismissed notification ids — cleared on redeploy; per org. */
const dismissedByOrg = new Map<string, Set<string>>();

function dismissedSet(organizationId: string): Set<string> {
  let set = dismissedByOrg.get(organizationId);
  if (!set) {
    set = new Set();
    dismissedByOrg.set(organizationId, set);
  }
  return set;
}

export function dismissNotification(organizationId: string, eventId: string): boolean {
  if (!eventId) return false;
  dismissedSet(organizationId).add(eventId);
  return true;
}

export function dismissNotifications(organizationId: string, eventIds: string[]): number {
  const set = dismissedSet(organizationId);
  let count = 0;
  for (const id of eventIds) {
    if (!id) continue;
    set.add(id);
    count += 1;
  }
  return count;
}

export function isNotificationDismissed(organizationId: string, eventId: string): boolean {
  return dismissedByOrg.get(organizationId)?.has(eventId) ?? false;
}

export function filterUndismissedNotifications<T extends { id: string }>(
  organizationId: string,
  events: T[]
): T[] {
  const dismissed = dismissedByOrg.get(organizationId);
  if (!dismissed?.size) return events;
  return events.filter((event) => !dismissed.has(event.id));
}

export function clearDismissedNotifications(organizationId: string): void {
  dismissedByOrg.delete(organizationId);
}
