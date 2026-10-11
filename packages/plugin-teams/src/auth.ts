export { portalAuthenticator } from '@kieksme/csp-core/support';
export function supportAuthorizer(
  tenantId: string,
  clientId: string,
  secret: string,
  groupId: string,
  fetcher: typeof fetch = fetch,
  teamId?: string,
) {
  let token: { value: string; expires: number } | undefined;
  return async (userId: string): Promise<boolean> => {
    if (!/^[a-f0-9-]{36}$/i.test(userId)) return false;
    try {
      if (!token || token.expires < Date.now()) {
        const r = await fetcher(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: 'POST',
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: secret,
              grant_type: 'client_credentials',
              scope: 'https://graph.microsoft.com/.default',
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!r.ok) return false;
        const b = await r.json();
        if (typeof b.access_token !== 'string') return false;
        token = {
          value: b.access_token,
          expires:
            Date.now() + Math.max(0, Number(b.expires_in ?? 300) - 60) * 1000,
        };
      }
      if (teamId) {
        if (teamId !== groupId || !/^[a-f0-9-]{36}$/i.test(teamId))
          return false;
        const query = new URLSearchParams({
          $filter: `(microsoft.graph.aadUserConversationMember/userId eq '${userId}')`,
          $select: 'userId',
        });
        const response = await fetcher(
          `https://graph.microsoft.com/v1.0/teams/${teamId}/members?${query}`,
          {
            headers: { Authorization: `Bearer ${token.value}` },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok) return false;
        const body = await response.json();
        return (
          Array.isArray(body.value) &&
          body.value.some(
            (member: { userId?: string }) => member.userId === userId,
          )
        );
      }
      const r = await fetcher(
        `https://graph.microsoft.com/v1.0/users/${userId}/checkMemberGroups`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.value}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ groupIds: [groupId] }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!r.ok) return false;
      const b = await r.json();
      return Array.isArray(b.value) && b.value.includes(groupId);
    } catch {
      return false;
    }
  };
}
