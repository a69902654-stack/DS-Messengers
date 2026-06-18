import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type MusicTrack = {
  id: string;
  filename: string;
  uri: string;
  duration: number; // ms
  albumId?: string;
  creationTime?: number;
};

type MusicContextType = {
  tracks: MusicTrack[];
  filteredTracks: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  position: number; // ms
  duration: number; // ms
  searchQuery: string;
  permissionGranted: boolean;
  loadingTracks: boolean;
  setSearchQuery: (q: string) => void;
  playTrack: (track: MusicTrack) => Promise<void>;
  playFromUri: (uri: string, title?: string) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  playNext: () => void;
  playPrev: () => void;
  stopTrack: () => Promise<void>;
  requestPermission: () => Promise<void>;
};

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<MusicTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searchQuery, setSearchQueryState] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const currentIndexRef = useRef(0);

  // درخواست مجوز و بارگذاری آهنگ‌ها
  const requestPermission = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;
    setPermissionGranted(true);
    await loadTracks();
  }, []);

  const loadTracks = async () => {
    setLoadingTracks(true);
    try {
      let allTracks: MusicTrack[] = [];
      let after: string | undefined;

      do {
        const result = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.audio,
          first: 200,
          after,
        });

        const mapped = result.assets.map((a) => ({
          id: a.id,
          filename: a.filename.replace(/\.[^/.]+$/, ''), // بدون پسوند
          uri: a.uri,
          duration: Math.round(a.duration * 1000),
          albumId: a.albumId,
          creationTime: a.creationTime,
        }));

        allTracks = [...allTracks, ...mapped];
        after = result.hasNextPage ? result.endCursor : undefined;
      } while (after);

      setTracks(allTracks);
      setFilteredTracks(allTracks);
    } finally {
      setLoadingTracks(false);
    }
  };

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });

    MediaLibrary.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setPermissionGranted(true);
        loadTracks();
      }
    });
  }, []);

  // AI جست‌وجوی لوکال — fuzzy search روی نام فایل
  const setSearchQuery = useCallback(
    (q: string) => {
      setSearchQueryState(q);
      if (!q.trim()) {
        setFilteredTracks(tracks);
        return;
      }
      const query = q.trim().toLowerCase();
      const tokens = query.split(/\s+/);

      const scored = tracks
        .map((t) => {
          const name = t.filename.toLowerCase();
          // امتیازدهی: هر توکن که در نام پیدا شود +1
          const score = tokens.reduce(
            (acc, token) => acc + (name.includes(token) ? 1 : 0),
            0
          );
          return { track: t, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      setFilteredTracks(scored.map((x) => x.track));
    },
    [tracks]
  );

  const stopAndUnload = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  };

  const playTrack = useCallback(async (track: MusicTrack) => {
    await stopAndUnload();
    setCurrentTrack(track);
    setIsPlaying(false);
    setPosition(0);
    setDuration(track.duration || 0);

    // ایندکس برای next/prev
    const idx = filteredTracks.findIndex((t) => t.id === track.id);
    currentIndexRef.current = idx >= 0 ? idx : 0;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPosition(status.positionMillis);
          setDuration(status.durationMillis ?? track.duration);
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            playNextInternal();
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      console.log('playTrack error:', e);
    }
  }, [filteredTracks]);

  // پخش از URI مستقیم (برای پیام‌های چت)
  const playFromUri = useCallback(async (uri: string, title?: string) => {
    const fakeTrack: MusicTrack = {
      id: `uri-${Date.now()}`,
      filename: title ?? 'موزیک',
      uri,
      duration: 0,
    };
    await playTrack(fakeTrack);
  }, [playTrack]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch {}
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(ms);
      setPosition(ms);
    } catch {}
  }, []);

  const playNextInternal = () => {
    setFilteredTracks((prev) => {
      const next = prev[(currentIndexRef.current + 1) % prev.length];
      if (next) {
        // async call بدون await — intentional
        playTrack(next);
      }
      return prev;
    });
  };

  const playNext = useCallback(() => {
    playNextInternal();
  }, [filteredTracks, playTrack]);

  const playPrev = useCallback(() => {
    setFilteredTracks((prev) => {
      const idx = currentIndexRef.current;
      const prevIdx = (idx - 1 + prev.length) % prev.length;
      const prevTrack = prev[prevIdx];
      if (prevTrack) playTrack(prevTrack);
      return prev;
    });
  }, [filteredTracks, playTrack]);

  const stopTrack = useCallback(async () => {
    await stopAndUnload();
    setCurrentTrack(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, []);

  return (
    <MusicContext.Provider
      value={{
        tracks,
        filteredTracks,
        currentTrack,
        isPlaying,
        position,
        duration,
        searchQuery,
        permissionGranted,
        loadingTracks,
        setSearchQuery,
        playTrack,
        playFromUri,
        togglePlayPause,
        seekTo,
        playNext,
        playPrev,
        stopTrack,
        requestPermission,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside MusicProvider');
  return ctx;
}
