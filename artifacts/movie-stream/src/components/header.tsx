import { Link, useLocation } from 'wouter';
import { Search, Film } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export function Header() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Film className="w-7 h-7 text-primary" />
          <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            CineQueue
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              location === '/' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Browse
          </Link>
          <Link
            href="/my-list"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              location === '/my-list' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            My List
          </Link>
        </nav>

        <form onSubmit={handleSearch} className="relative w-64 hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search movies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-border focus:border-primary transition-colors"
            data-testid="input-search"
          />
        </form>
      </div>
    </header>
  );
}
