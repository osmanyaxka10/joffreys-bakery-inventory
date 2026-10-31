const config = window.__POSTHOG_CONFIG__ || {};
let client = null;
let initPromise = null;

async function getClient() {
  if (client) return client;
  if (initPromise) return initPromise;
  if (!config.token || !config.apiHost) return null;

  initPromise = (async () => {
    try {
      const module = await import('https://esm.sh/posthog-js@latest');
      const posthog = module.default;
      posthog.init(config.token, {
        api_host: config.apiHost,
        defaults: '2026-08-30',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        person_profiles: 'identified_only',
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
          capture_console_errors: false
        }
      });
      client = posthog;
      return client;
    } catch (error) {
      console.warn('PostHog could not initialize; bakery operations remain available.', error);
      return null;
    }
  })();
  return initPromise;
}

export async function analyticsIdentify(userId) {
  if (!userId) return;
  const ph = await getClient();
  if (ph) ph.identify(String(userId));
}

export async function analyticsReset() {
  const ph = await getClient();
  if (ph) ph.reset();
}

export async function analyticsTrack(event, properties = {}) {
  const ph = await getClient();
  if (ph) ph.capture(event, properties);
}

export async function analyticsError(error, properties = {}) {
  const ph = await getClient();
  if (ph && error) ph.captureException(error, properties);
}
