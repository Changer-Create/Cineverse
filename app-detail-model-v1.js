(() => {
  'use strict';
  if (window.CineverseDetail) return;

  const wantsMovie = movie => movie?.personal?.want == null
    ? movie?.personal?.status === 'want'
    : Boolean(movie.personal.want);
  const hasWatches = movie => Boolean((movie?.watchHistory || []).length);
  const isOrphan = movie => !wantsMovie(movie) && !hasWatches(movie);

  function setWanted(movie, wanted) {
    movie.personal = movie.personal || {};
    movie.personal.want = Boolean(wanted);
    if (wanted && !hasWatches(movie)) movie.personal.status = 'want';
    if (!wanted && movie.personal.status === 'want') movie.personal.status = hasWatches(movie) ? 'watched' : 'follow';
    movie.updatedAt = new Date().toISOString();
    return movie;
  }

  function clearWatches(movie) {
    movie.watchHistory = [];
    if (movie.personal?.status === 'watched') movie.personal.status = wantsMovie(movie) ? 'want' : 'follow';
    if (movie.personal) movie.personal.rating = null;
    movie.updatedAt = new Date().toISOString();
    return movie;
  }

  window.CineverseDetail = Object.freeze({ wantsMovie, hasWatches, isOrphan, setWanted, clearWatches });
})();
