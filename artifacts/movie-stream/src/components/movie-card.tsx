import { Movie } from '@workspace/api-client-react/src/generated/api.schemas';
import { Link } from 'wouter';
import { Star, Clock, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddToWatchlist, useRemoveFromWatchlist } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListMoviesQueryKey,
  getGetMovieQueryKey,
  getListWatchlistQueryKey,
} from '@workspace/api-client-react';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const queryClient = useQueryClient();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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

  return (
    <Link href={`/movie/${movie.id}`}>
      <div
        className="group relative aspect-[2/3] overflow-hidden rounded-md bg-muted cursor-pointer"
        data-testid={`card-movie-${movie.id}`}
      >
        <img
          src={movie.posterUrl}
          alt={movie.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            <h3 className="font-bold text-sm line-clamp-2" style={{ fontFamily: 'var(--font-display)' }}>
              {movie.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-foreground/80">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-primary text-primary" />
                <span>{movie.rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{movie.durationMinutes}m</span>
              </div>
              <span>{movie.year}</span>
            </div>
            
            <Button
              size="sm"
              variant={movie.inWatchlist ? 'secondary' : 'default'}
              className="w-full"
              onClick={handleWatchlistToggle}
              disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
              data-testid={`button-watchlist-${movie.id}`}
            >
              {movie.inWatchlist ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  In My List
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1" />
                  Add to List
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
