type GoogleTokenResponse = { access_token?: string; error?: string };

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisLoadPromise: Promise<void> | null = null;
let tokenClient: any = null;
let accessToken: string | null = null;

const loadGisScript = (): Promise<void> => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')));
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity script'));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
};

const getClientId = () => {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_OAUTH_CLIENT_ID is not configured');
  }
  return clientId;
};

const requestAccessToken = async (prompt: '' | 'consent' = ''): Promise<string> => {
  await loadGisScript();
  const clientId = getClientId();

  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPE,
      callback: () => undefined,
    });
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp: GoogleTokenResponse) => {
      if (!resp || resp.error || !resp.access_token) {
        reject(new Error(resp?.error || 'Failed to obtain Google access token'));
        return;
      }
      accessToken = resp.access_token;
      resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt });
  });
};

export const createGoogleCalendarEvent = async (input: {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  recurrence?: string[];
}) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const payload = {
    summary: input.title,
    description: input.description || '',
    start: { dateTime: input.start.toISOString(), timeZone: timezone },
    end: { dateTime: input.end.toISOString(), timeZone: timezone },
    recurrence: input.recurrence || undefined,
  };

  const tryInsert = async (token: string) => {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Calendar API error (${response.status}): ${text}`);
    }
    return response.json();
  };

  try {
    const token = accessToken || (await requestAccessToken('consent'));
    return await tryInsert(token);
  } catch (firstErr) {
    const refreshed = await requestAccessToken('consent');
    return await tryInsert(refreshed);
  }
};

export const createGoogleMeetLinkForConsultation = async (input: {
  title: string;
  description?: string;
  start?: Date;
  end?: Date;
}) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const start = input.start || new Date();
  const end = input.end || new Date(start.getTime() + 30 * 60 * 1000);

  const payload = {
    summary: input.title,
    description: input.description || '',
    start: { dateTime: start.toISOString(), timeZone: timezone },
    end: { dateTime: end.toISOString(), timeZone: timezone },
    conferenceData: {
      createRequest: {
        requestId: `consult-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const tryInsertWithMeet = async (token: string) => {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Calendar API error (${response.status}): ${text}`);
    }

    const event = await response.json();
    const meetLink =
      event?.hangoutLink ||
      event?.conferenceData?.entryPoints?.find((entry: any) => entry?.entryPointType === 'video')
        ?.uri ||
      null;

    if (!meetLink) {
      throw new Error('Google Calendar event created but Meet link was not returned.');
    }

    return {
      meetLink: String(meetLink),
      eventId: String(event?.id || ''),
      eventHtmlLink: String(event?.htmlLink || ''),
    };
  };

  try {
    const token = accessToken || (await requestAccessToken('consent'));
    return await tryInsertWithMeet(token);
  } catch {
    const refreshed = await requestAccessToken('consent');
    return await tryInsertWithMeet(refreshed);
  }
};
