import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moviesTable = pgTable("movies", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  synopsis: text("synopsis").notNull(),
  genre: text("genre").notNull(),
  year: integer("year").notNull(),
  rating: real("rating").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  posterUrl: text("poster_url").notNull(),
  backdropUrl: text("backdrop_url").notNull(),
  cast: text("cast").array().notNull(),
  director: text("director").notNull(),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMovieSchema = createInsertSchema(moviesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof moviesTable.$inferSelect;

export const watchlistTable = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  movieId: integer("movie_id")
    .notNull()
    .references(() => moviesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlistTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type WatchlistRow = typeof watchlistTable.$inferSelect;
