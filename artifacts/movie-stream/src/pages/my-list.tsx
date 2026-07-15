import { useListWatchlist } from '@workspace/api-client-react';
import { Header } from '@/components/header';
import { MovieCard } from '@/components/movie-card';
import { Film } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function MyList() {
  const { data: movies, isLoading } = useListWatchlist();

  return (
    <div className="min-h-[100dvh] film-grain">
      <Header />
      
      <main className="pt-16 container mx-auto px-4 py-8">
        <h1
          className="text-3xl md:text-4xl font-bold mb-8"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          My List
        </h1>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : movies && movies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center">
              <Film className="w-12 h-12 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2
                className="text-2xl font-bold text-foreground"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Your list is empty
              </h2>
              <p className="text-muted-foreground max-w-md">
                Start building your watchlist by adding movies you want to watch later.
                Browse our catalog and click the "Add to List" button on any movie.
              </p>
            </div>
            <Link href="/">
              <Button size="lg" data-testid="button-browse">
                Browse Movies
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
