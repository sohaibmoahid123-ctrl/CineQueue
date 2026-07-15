import { Movie } from '@workspace/api-client-react/src/generated/api.schemas';
import { Play, Plus, Info, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useAddToWatchlist, useRemoveFromWatchlist } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListMoviesQueryKey,
  getGetMovieQueryKey,
  getListWatchlistQueryKey,
} from '@workspace/api-client-react';
import { useState, useEffect } from 'react';

interface HeroSpotlightProps {
  movies: Movie[];
}

export function HeroSpotlight({ movies }: HeroSpotlightProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const queryClient = useQueryClient();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const movie = movies[currentIndex];

  useEffect(() => {
    if (movies.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % movies.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [movies.length]);

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

  if (!movie) return null;

  return (
    <div className="relative h-[70vh] min-h-[500px] w-full overflow-hidden">
      <div
        key={movie.id}
        className="absolute inset-0 transition-opacity duration-1000"
      >
        <img
          src={movie.backdropUrl}
          alt={movie.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative h-full container mx-auto px-4 flex items-end pb-16">
        <div className="max-w-2xl space-y-4 mb-8">
          <h1
            className="text-4xl md:text-6xl font-bold leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid={`text-hero-title-${movie.id}`}
          >
            {movie.title}
          </h1>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="px-2 py-1 bg-primary text-primary-foreground rounded font-semibold">
              {movie.rating.toFixed(1)}
            </span>
            <span>{movie.year}</span>
            <span>{movie.durationMinutes} min</span>
            <span className="text-muted-foreground">{movie.genre}</span>
          </div>

          <p className="text-base md:text-lg text-foreground/90 line-clamp-3">
            {movie.synopsis}
          </p>

          <div className="flex gap-3 pt-2">
            <Link href={`/movie/${movie.id}?play=true`}>
              <Button size="lg" className="gap-2" data-testid={`button-play-${movie.id}`}>
                <Play className="w-5 h-5 fill-current" />
                Play
              </Button>
            </Link>
            
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
              onClick={handleWatchlistToggle}
              disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
              data-testid={`button-hero-watchlist-${movie.id}`}
            >
              {movie.inWatchlist ? (
                <>
                  <Check className="w-5 h-5" />
                  In My List
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  My List
                </>
              )}
            </Button>

            <Link href={`/movie/${movie.id}`}>
              <Button size="lg" variant="outline" className="gap-2">
                <Info className="w-5 h-5" />
                Info
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {movies.length > 1 && (
        <div className="absolute bottom-8 right-8 flex gap-2">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-primary w-8'
                  : 'bg-muted-foreground/50 hover:bg-muted-foreground'
              }`}
              data-testid={`button-hero-indicator-${index}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
