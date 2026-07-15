import { useParams, useLocation } from 'wouter';
import { useGetMovie, useAddToWatchlist, useRemoveFromWatchlist } from '@workspace/api-client-react';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Play, Plus, Check, ArrowLeft, Clock, Calendar, Star } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListMoviesQueryKey,
  getGetMovieQueryKey,
  getListWatchlistQueryKey,
} from '@workspace/api-client-react';
import { NowPlayingModal } from '@/components/now-playing-modal';
import { useState, useEffect } from 'react';

export default function MovieDetail() {
  const params = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const movieId = params.id ? Number(params.id) : 0;
  
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const shouldAutoPlay = searchParams.get('play') === 'true';
  
  const [showPlayer, setShowPlayer] = useState(false);
  
  const { data: movie, isLoading, error } = useGetMovie(movieId);
  const queryClient = useQueryClient();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  useEffect(() => {
    if (shouldAutoPlay && movie) {
      setShowPlayer(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('play');
      window.history.replaceState({}, '', url.toString());
    }
  }, [shouldAutoPlay, movie]);

  const handleWatchlistToggle = () => {
    if (!movie) return;

    if (movie.inWatchlist) {
      removeFromWatchlist.mutate(
        { movieId: movie.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListWatchlistQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListMoviesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetMovieQueryKey(movie.id) });
          },
        }
      );
    } else {
      addToWatchlist.mutate(
        { movieId: movie.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListWatchlistQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListMoviesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetMovieQueryKey(movie.id) });
          },
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] film-grain">
        <Header />
        <main className="pt-16">
          <div className="relative h-[60vh] bg-muted animate-pulse" />
          <div className="container mx-auto px-4 py-8 space-y-4">
            <div className="h-10 w-2/3 bg-muted rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
            <div className="h-24 w-full bg-muted rounded animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-[100dvh] film-grain">
        <Header />
        <main className="pt-16 flex items-center justify-center min-h-[80vh]">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Movie not found
            </h1>
            <Link href="/">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Browse
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] film-grain">
      <Header />
      
      <main className="pt-16">
        <div className="relative h-[60vh] min-h-[400px] overflow-hidden">
          <img
            src={movie.backdropUrl}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          
          <Link href="/" className="absolute top-8 left-4 z-10">
            <Button variant="secondary" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        <div className="container mx-auto px-4 -mt-32 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full max-w-sm mx-auto lg:mx-0 rounded-lg shadow-2xl"
              />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div>
                <h1
                  className="text-4xl md:text-5xl font-bold mb-4"
                  style={{ fontFamily: 'var(--font-display)' }}
                  data-testid="text-movie-title"
                >
                  {movie.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-4 text-sm mb-6">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-semibold">
                    <Star className="w-4 h-4 fill-current" />
                    {movie.rating.toFixed(1)}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {movie.year}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {movie.durationMinutes} min
                  </div>
                  <span className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md">
                    {movie.genre}
                  </span>
                </div>

                <div className="flex gap-3">
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => setShowPlayer(true)}
                    data-testid="button-play-movie"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Play
                  </Button>
                  
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2"
                    onClick={handleWatchlistToggle}
                    disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
                    data-testid="button-toggle-watchlist"
                  >
                    {movie.inWatchlist ? (
                      <>
                        <Check className="w-5 h-5" />
                        In My List
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add to My List
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                    Synopsis
                  </h2>
                  <p className="text-foreground/80 leading-relaxed" data-testid="text-synopsis">
                    {movie.synopsis}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Director</h3>
                    <p className="text-foreground" data-testid="text-director">{movie.director}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1">Cast</h3>
                    <p className="text-foreground" data-testid="text-cast">
                      {movie.cast.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-24" />
      </main>

      {movie && (
        <NowPlayingModal
          movie={movie}
          open={showPlayer}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </div>
  );
}
