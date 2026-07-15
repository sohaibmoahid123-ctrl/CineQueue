import { Movie } from '@workspace/api-client-react/src/generated/api.schemas';
import { MovieCard } from './movie-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  loading?: boolean;
}

export function MovieRow({ title, movies, loading }: MovieRowProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold px-4" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h2>
        <div className="px-4">
          <div className="flex gap-4 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[160px] aspect-[2/3] bg-muted rounded-md animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (movies.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold px-4" style={{ fontFamily: 'var(--font-display)' }}>
        {title}
      </h2>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 px-4 pb-4">
          {movies.map((movie) => (
            <div key={movie.id} className="flex-shrink-0 w-[160px] md:w-[200px]">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
