import { useListFeaturedMovies, useListMovies, useListGenres } from '@workspace/api-client-react';
import { HeroSpotlight } from '@/components/hero-spotlight';
import { MovieRow } from '@/components/movie-row';
import { Header } from '@/components/header';
import { useLocation } from 'wouter';

export default function Home() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const searchQuery = searchParams.get('search') || '';

  const { data: featuredMovies, isLoading: featuredLoading } = useListFeaturedMovies();
  const { data: genres } = useListGenres();
  const { data: searchResults, isLoading: searchLoading } = useListMovies(
    searchQuery ? { search: searchQuery } : undefined,
    { query: { enabled: !!searchQuery } }
  );

  return (
    <div className="min-h-[100dvh] film-grain">
      <Header />
      
      <main className="pt-16">
        {!searchQuery && (
          <>
            {featuredLoading ? (
              <div className="h-[70vh] min-h-[500px] bg-muted animate-pulse" />
            ) : featuredMovies && featuredMovies.length > 0 ? (
              <HeroSpotlight movies={featuredMovies} />
            ) : null}

            <div className="space-y-8 py-8">
              {genres?.map((genreSummary) => (
                <GenreRow key={genreSummary.genre} genre={genreSummary.genre} />
              ))}
            </div>
          </>
        )}

        {searchQuery && (
          <div className="container mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Search results for "{searchQuery}"
            </h1>
            {searchLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-muted rounded-md animate-pulse" />
                ))}
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {searchResults.map((movie) => {
                  const MovieCard = require('@/components/movie-card').MovieCard;
                  return <MovieCard key={movie.id} movie={movie} />;
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">No movies found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function GenreRow({ genre }: { genre: string }) {
  const { data: movies, isLoading } = useListMovies({ genre });

  return <MovieRow title={genre} movies={movies || []} loading={isLoading} />;
}
