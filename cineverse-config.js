(() => {
  'use strict';
  if (window.CineverseConfig) return;

  const supabaseUrl = 'https://bjjralybdcuczwllxbvo.supabase.co';
  const publicAppUrl = 'https://cj956151388-png.github.io/movie-collection/';
  const endpoints = Object.freeze({
    adminAuth: `${supabaseUrl}/functions/v1/admin-auth`,
    adminGlobalConfig: `${supabaseUrl}/functions/v1/admin-global-config`,
    globalConfigTable: `${supabaseUrl}/rest/v1/global_site_config?select=config_key,data_json,updated_at&order=config_key.asc`,
    tmdbProxy: `${supabaseUrl}/functions/v1/tmdb-proxy`,
  });

  window.CineverseConfig = Object.freeze({
    supabaseUrl,
    supabasePublishableKey: 'sb_publishable_QiJNdLR-qykVqPkPrmePFg_x5wW7Owu',
    publicAppUrl,
    endpoints,
  });
})();
