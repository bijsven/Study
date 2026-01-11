import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: 'https://b0ba56363b6f62021e0d7806f9ed7b83@o4510668030214144.ingest.de.sentry.io/4510668031656016',

  tracesSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,
  telemetry: false,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: import.meta.env.DEV,
});
