(() => {
  'use strict';
  if (window.CineversePublicConfig) return;

  const publicAppUrl = 'https://changer-create.github.io/Cineverse/';
  const supabaseUrl = 'https://bjjralybdcuczwllxbvo.supabase.co';
  const supabasePublishableKey = 'sb_publishable_QiJNdLR-qykVqPkPrmePFg_x5wW7Owu';

  const config = Object.freeze({
    version: 1,
    publicAppUrl,
    supabaseUrl,
    supabasePublishableKey,
    tmdbProxyUrl: `${supabaseUrl}/functions/v1/tmdb-proxy`,
    adminAuthUrl: `${supabaseUrl}/functions/v1/admin-auth`,
    adminGlobalConfigUrl: `${supabaseUrl}/functions/v1/admin-global-config`
  });

  window.CineversePublicConfig = config;
})();