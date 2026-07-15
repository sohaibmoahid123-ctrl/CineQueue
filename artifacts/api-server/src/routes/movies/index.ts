import { Router, type IRouter } from "express";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db, moviesTable, watchlistTable } from "@workspace/db";
import {
  ListMoviesQueryParams,
  ListMoviesResponse,
  ListFeaturedMoviesResponse,
  GetMovieParams,
  GetMovieResponse,
  ListGenresResponse,
  ListWatchlistResponse,
  AddToWatchlistParams,
  AddToWatchlistResponse,
  RemoveFromWatchlistParams,
} from "@workspace/api-zod";
import type { Movie } from "@workspace/db";

const router: IRouter = Router();

async function getWatchlistedMovieIds(): Promise<Set<number>> {
  const rows = await db
    .select({ movieId: watchlistTable.movieId })
    .from(watchlistTable);
  return new Set(rows.map((r) => r.movieId));
}

function toApiMovie(movie: Movie, watchlisted: Set<number>) {
  return {
    id: movie.id,
    title: movie.title,
    synopsis: movie.synopsis,
    genre: movie.genre,
    year: movie.year,
    rating: movie.rating,
    durationMinutes: movie.durationMinutes,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    cast: movie.cast,
    director: movie.director,
    isFeatured: movie.isFeatured,
    inWatchlist: watchlisted.has(movie.id),
  };
}

router.get("/movies", async (req, res): Promise<void> => {
  const query = ListMoviesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { genre, search } = query.data;
  const conditions = [];
  if (genre) {
    conditions.push(eq(moviesTable.genre, genre));
  }
  if (search) {
    conditions.push(
      or(
        ilike(moviesTable.title, `%${search}%`),
        ilike(moviesTable.synopsis, `%${search}%`),
      ),
    );
  }

  const rows = await db
    .select()
    .from(moviesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(moviesTable.title);

  const watchlisted = await getWatchlistedMovieIds();
  res.json(
    ListMoviesResponse.parse(rows.map((m) => toApiMovie(m, watchlisted))),
  );
});

router.get("/movies/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(moviesTable)
    .where(eq(moviesTable.isFeatured, true))
    .orderBy(moviesTable.title);

  const watchlisted = await getWatchlistedMovieIds();
  res.json(
    ListFeaturedMoviesResponse.parse(
      rows.map((m) => toApiMovie(m, watchlisted)),
    ),
  );
});

router.get("/movies/:id", async (req, res): Promise<void> => {
  const params = GetMovieParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [movie] = await db
    .select()
    .from(moviesTable)
    .where(eq(moviesTable.id, params.data.id));

  if (!movie) {
    res.status(404).json({ error: "Movie not found" });
    return;
  }

  const watchlisted = await getWatchlistedMovieIds();
  res.json(GetMovieResponse.parse(toApiMovie(movie, watchlisted)));
});

router.get("/genres", async (_req, res): Promise<void> => {
  const rows = await db.select({ genre: moviesTable.genre }).from(moviesTable);
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.genre, (counts.get(row.genre) ?? 0) + 1);
  }
  const genres = Array.from(counts.entries())
    .map(([genre, movieCount]) => ({ genre, movieCount }))
    .sort((a, b) => a.genre.localeCompare(b.genre));

  res.json(ListGenresResponse.parse(genres));
});

router.get("/watchlist", async (_req, res): Promise<void> => {
  const entries = await db.select().from(watchlistTable);
  const movieIds = entries.map((e) => e.movieId);

  if (movieIds.length === 0) {
    res.json(ListWatchlistResponse.parse([]));
    return;
  }

  const rows = await db
    .select()
    .from(moviesTable)
    .where(inArray(moviesTable.id, movieIds));

  const watchlisted = new Set(movieIds);
  res.json(
    ListWatchlistResponse.parse(rows.map((m) => toApiMovie(m, watchlisted))),
  );
});

router.post("/watchlist/:movieId", async (req, res): Promise<void> => {
  const params = AddToWatchlistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [movie] = await db
    .select()
    .from(moviesTable)
    .where(eq(moviesTable.id, params.data.movieId));

  if (!movie) {
    res.status(404).json({ error: "Movie not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.movieId, params.data.movieId));

  if (!existing) {
    await db
      .insert(watchlistTable)
      .values({ movieId: params.data.movieId });
  }

  res
    .status(201)
    .json(AddToWatchlistResponse.parse({ movieId: params.data.movieId }));
});

router.delete("/watchlist/:movieId", async (req, res): Promise<void> => {
  const params = RemoveFromWatchlistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(watchlistTable)
    .where(eq(watchlistTable.movieId, params.data.movieId));

  res.sendStatus(204);
});

export default router;
