import { Movie } from '@workspace/api-client-react/src/generated/api.schemas';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Pause, Volume2, VolumeX, Maximize, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NowPlayingModalProps {
  movie: Movie;
  open: boolean;
  onClose: () => void;
}

export function NowPlayingModal({ movie, open, onClose }: NowPlayingModalProps) {
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl p-0 bg-black border-none">
        <div className="relative aspect-video bg-black">
          <img
            src={movie.backdropUrl}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute inset-0 bg-black/20" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
            data-testid="button-close-player"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center mx-auto animate-pulse">
                <div className="w-16 h-16 rounded-full bg-primary/40 flex items-center justify-center">
                  <Pause className="w-8 h-8 text-primary" />
                </div>
              </div>
              <p className="text-sm text-foreground/60">
                No video available - this is a demo
              </p>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 space-y-4">
            <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-primary rounded-full" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPlaying(!playing)}
                  className="hover:bg-white/10"
                  data-testid="button-play-pause"
                >
                  <Pause className="w-5 h-5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setMuted(!muted)}
                  className="hover:bg-white/10"
                  data-testid="button-mute"
                >
                  {muted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>

                <div className="text-sm">
                  <span className="text-foreground">0:32</span>
                  <span className="text-muted-foreground"> / {movie.durationMinutes}:00</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg hidden md:block" style={{ fontFamily: 'var(--font-display)' }}>
                  {movie.title}
                </h3>

                <Button
                  size="icon"
                  variant="ghost"
                  className="hover:bg-white/10"
                  data-testid="button-fullscreen"
                >
                  <Maximize className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
