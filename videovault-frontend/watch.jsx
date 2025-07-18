
import React, { useState, useEffect, useRef } from "react";
import { Video } from "@/entities/Video";
import { Playlist } from "@/entities/Playlist";
import { UserSettings } from "@/entities/UserSettings";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Film, ExternalLink, Loader2, Heart, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Settings, ListVideo, ChevronLeft, Users, X, AlertTriangle, Maximize, Minimize, LogOut, Fullscreen, PlaySquare, SquareSlash, Star, ChevronRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import YouTubePlayer from "../components/YouTubePlayer";
import Html5VideoPlayer from "../components/Html5VideoPlayer";
import { useTranslation } from "../components/LanguageProvider";
import VideoCard from "./VideoCard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Save, PlayCircle } from 'lucide-react';
import { ParentalSettings } from "@/entities/ParentalSettings";
import { useParentalControls } from '@/components/hooks/useParentalControls';
import { VideoIdCache } from "@/components/VideoIdCache";
import { loadVideosInBatches } from "@/components/videoLoader";
import KidsExitButton from "../components/KidsExitButton";

// Helper function to format time (seconds to HH:MM:SS or MM:SS)
const formatTime = (timeInSeconds) => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(timeInSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
  const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${paddedMinutes}:${paddedSeconds}`;
};


export default function Watch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const exitButtonRef = useRef(null);
  const countdownRef = useRef(null);
  const { toast } = useToast();

  const [video, setVideo] = useState(null);
  const [playlistVideos, setPlaylistVideos] = useState([]);
  const [playlistSuggestions, setPlaylistSuggestions] = useState([]);
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [currentPlaylistName, setCurrentPlaylistName] = useState("");
  const [currentPlaylistId, setCurrentPlaylistId] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(-1);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [showNextVideoPreview, setShowNextVideoPreview] = useState(false);
  const [nextVideoInfo, setNextVideoInfo] = useState(null);
  const [countdown, setCountdown] = useState(5);

  const [userSettings, setUserSettings] = useState(null);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const [activeTab, setActiveTab] = useState("description");
  const [videoNote, setVideoNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [isKidsModeActive, setIsKidsModeActive] = useState(false);
  const { checkPin, isPinRequired } = useParentalControls();
  const [isRandomPlayMode, setIsRandomPlayMode] = useState(false);

  // isFullScreenPlayer is now simply `isFullScreen`
  
  const scrollLeft = () => {
    if (scrollAreaRef.current) {
      const container = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (container) {
        container.scrollBy({ left: -250, behavior: 'smooth' });
      }
    }
  };
  
  const scrollRight = () => {
    if (scrollAreaRef.current) {
      const container = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (container) {
        container.scrollBy({ left: 250, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    // Add/remove class from body when fullscreen state changes
    if (isFullScreen) {
      document.body.classList.add('watch-page-fullscreen');
    } else {
      document.body.classList.remove('watch-page-fullscreen');
    }
    // Cleanup function to remove class when component unmounts or isFullScreen changes back
    return () => {
      document.body.classList.remove('watch-page-fullscreen');
    };
  }, [isFullScreen]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setIsKidsModeActive(params.get('kids') === 'true');
    setAutoplayEnabled(params.get('kids') !== 'true'); 
    
    loadVideoAndPlaylist();
    fetchUserSettings();

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      document.body.style.overflow = 'auto';
    };
  }, [location.search]);

  const fetchUserSettings = async () => {
    try {
      const user = await User.me().catch(() => null);
      if (user) {
        const settings = await UserSettings.filter({ created_by: user.email });
        if (settings && settings.length > 0) {
          setUserSettings(settings[0]);
          // Apply user's autoplay preference if available, otherwise keep current
          if (settings[0].hasOwnProperty('enableAutoplay')) { // Assuming enableAutoplay is a field in UserSettings
             setAutoplayEnabled(settings[0].enableAutoplay);
          }
          if (settings[0].videoPlayerSize === 'theater') {
            // setTheaterMode(true); // Let's not force theater mode on load, user can toggle
          }
        }
      }
    } catch (error) {
      console.warn("Failed to fetch user settings:", error);
    }
  };

  const [loadingProgress, setLoadingProgress] = useState(0);

  const loadVideoAndPlaylist = async () => {
    setLoading(true);
    setError("");
    setLoadingProgress(0);
    // Reset all relevant states
    setVideo(null); 
    setIsPlaying(false);
    setCurrentPlaylist(null);   
    setCurrentPlaylistName("");
    setCurrentPlaylistId(null); 
    setPlaylistVideos([]);
    setPlaylistSuggestions([]);
    setShowNextVideoPreview(false);
    setNextVideoInfo(null);
    setCurrentVideoIndex(-1);
    setVideoNote(""); 

    try {
      const params = new URLSearchParams(location.search);
      const videoIdFromUrl = params.get('id');
      
      if (!videoIdFromUrl) {
        setError(t.no_video_id_provided);
        setLoading(false);
        return;
      }

      // Check cache first
      let videoData = VideoIdCache.getCachedVideo(videoIdFromUrl);
      
      if (!videoData) {
        try {
          videoData = await Video.get(videoIdFromUrl);
          if (videoData) {
            VideoIdCache.cacheVideo(videoIdFromUrl, videoData);
          } else {
            throw new Error("Video not found");
          }
        } catch (videoError) {
          // Mark this video ID as invalid in the cache
          VideoIdCache.markAsInvalid(videoIdFromUrl);
        
          let errorMessage;
          if (videoError.message?.includes('Object not found') || videoError.message?.includes('not found')) {
            errorMessage = t.video_no_longer_exists;
          } else if (videoError.message?.includes('Rate limit exceeded')) {
            errorMessage = t.please_try_again_later;
          } else {
            errorMessage = t.error_loading_video;
          }
          
          setError(errorMessage);
          toast({
            title: t.video_unavailable,
            description: errorMessage,
            variant: "destructive",
            duration: 5000,
          });
          
          setTimeout(() => {
            navigate(createPageUrl("Home"));
          }, 3000);
          
          setLoading(false);
          return;
        }
      }

      setVideo(videoData);
      setVideoNote(videoData.notes || "");
      
      // Handle playlist loading if a playlist ID is provided
      const playlistId = params.get('playlistId');
      if (playlistId) {
        try {
          const playlist = await Playlist.get(playlistId);
          if (playlist) {
            setCurrentPlaylist(playlist);
            setCurrentPlaylistId(playlistId);
            setCurrentPlaylistName(playlist.name || "");
            
            if (playlist.videoIds?.length > 0) {
              const { videos: loadedVideos, validIds } = await loadVideosInBatches(
                playlist.videoIds,
                {
                  batchSize: 3,
                  onProgress: (progress) => setLoadingProgress(progress)
                }
              );

              setPlaylistVideos(loadedVideos);
              
              // Find current video index and set next video
              const currentIndex = loadedVideos.findIndex(v => v.id === videoIdFromUrl);
              setCurrentVideoIndex(currentIndex);
              
              if (currentIndex !== -1 && currentIndex < loadedVideos.length - 1) {
                setNextVideoInfo(loadedVideos[currentIndex + 1]);
              }
              
              // Update playlist if needed to remove invalid videos
              if (validIds.length !== playlist.videoIds.length) {
                try {
                  await Playlist.update(playlistId, {
                    ...playlist,
                    videoIds: validIds
                  });
                } catch (updateError) {
                  console.warn("Could not update playlist with cleaned video IDs:", updateError);
                }
              }
            }
          }
        } catch (playlistError) {
          console.warn("Error loading playlist:", playlistError);
          // Don't fail the whole video playback if playlist loading fails
          toast({
            title: t.playlist_load_error,
            description: t.playlist_load_error_desc,
            variant: "default",
          });
        }
      }
      
      setLoading(false);
      if (autoplayEnabled) {
        setIsPlaying(true);
      }
      
    } catch (error) {
      console.error("Critical error in loadVideoAndPlaylist:", error);
      setError(t.unexpected_error);
      setLoading(false);
      
      setTimeout(() => {
        navigate(createPageUrl("Home"));
      }, 3000);
    }
  };

  const handlePlayerReady = () => {
    if (playerRef.current) {
        playerRef.current.setVolume?.(volume);
        playerRef.current.setMuted?.(isMuted);
        const dur = playerRef.current.getDuration?.();
        if (typeof dur === 'number') {
            setDuration(dur);
        } else {
            setDuration(0); 
        }
    }
    if (autoplayEnabled && video) {
        playerRef.current?.playVideo?.(); 
        setIsPlaying(true);
    }
  };

  const handleTimeUpdate = (time) => {
    if (!isSeeking) { // Only update if user is not actively seeking
      setCurrentTime(time);
    }
  };

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
  };
  
  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo?.();
    } else {
      playerRef.current.playVideo?.();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMuteToggle = () => {
    if (!playerRef.current) return;
    const newMutedState = !isMuted;
    playerRef.current.setMuted?.(newMutedState);
    setIsMuted(newMutedState);
  };

  const handleVolumeChange = (valueArray) => { // Expects valueArray to be [number]
    const newVolume = valueArray[0] / 100; 
    setVolume(newVolume);
    if (playerRef.current) {
        playerRef.current.setVolume?.(newVolume);
        if (newVolume > 0 && isMuted) {
            playerRef.current.setMuted?.(false);
            setIsMuted(false);
        }
    }
  };

  const handleSeek = (value) => {
    const newTime = value[0];
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(newTime);
      setCurrentTime(newTime); // Optimistically update currentTime
    }
  };

  const handleSliderValueChange = (valueArray) => {
    setCurrentTime(valueArray[0]); 
    setIsSeeking(true);
  };

  const handleSliderCommit = (valueArray) => {
    const newTime = valueArray[0];
    playerRef.current?.seekTo?.(newTime);
    setIsSeeking(false);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (autoplayEnabled && nextVideoInfo) {
      setShowNextVideoPreview(true);
    }
    setupNextVideoTimer();
  };

  const handlePlayNextVideo = (nextVideoId, playlistIdForNav, index) => {
    setShowNextVideoPreview(false); 
    if (countdownRef.current) clearInterval(countdownRef.current);

    let navUrl = `${createPageUrl("Watch")}?id=${nextVideoId}`;
    if (playlistIdForNav) { // Use the passed playlistIdForNav which should be currentPlaylistId
      navUrl += `&playlistId=${playlistIdForNav}`;
    }
    if (isKidsModeActive) {
      navUrl += `&kids=true`;
    }
    if (isRandomPlayMode) { // Persist random mode
      navUrl += `&random=true`;
    }
    navigate(navUrl);
  };

  const handlePlayPreviousVideo = () => {
    if (playlistVideos.length > 0 && currentVideoIndex > 0) {
      const prevVideo = playlistVideos[currentVideoIndex - 1];
      let navUrl = `${createPageUrl("Watch")}?id=${prevVideo.id}`;
      if (currentPlaylistId) {
        navUrl += `&playlistId=${currentPlaylistId}`;
      }
      if (isKidsModeActive) {
        navUrl += `&kids=true`;
      }
      if (isRandomPlayMode) {
          navUrl += '&random=true'; // Preserve random play mode when going to previous video
      }
      navigate(navUrl);
    } else {
      toast({ 
        title: t.start_of_playlist, 
        description: t.this_is_first_video
      });
    }
  };
  
  const handleToggleFavorite = async () => {
    if (!video) return;
    const newFavoriteStatus = !video.favorite;
    try {
      await Video.update(video.id, { favorite: newFavoriteStatus });
      toast({
        title: newFavoriteStatus ? 
          t.added_to_favorites : 
          t.removed_from_favorites,
      });
      setVideo(prev => ({...prev, favorite: newFavoriteStatus}));
    } catch (err) {
      console.error("Error updating favorite status:", err);
      toast({ 
        title: t.error_updating_favorite, 
        variant: "destructive" 
      });
    }
  };

  const toggleAutoplay = async () => {
    const newAutoplayState = !autoplayEnabled;
    setAutoplayEnabled(newAutoplayState); // Fixed typo here (newAutplayState -> newAutoplayState)
    if (userSettings) {
        try {
            await UserSettings.update(userSettings.id, { enableAutoplay: newAutoplayState }); // Corrected field name
        } catch(e) { 
            console.error("Failed to save autoplay setting", e); 
        }
    }
    if (!newAutoplayState && showNextVideoPreview) {
        setShowNextVideoPreview(false); 
        if(countdownRef.current) clearInterval(countdownRef.current);
    }
  };

  const toggleTheaterMode = () => {
    setTheaterMode(!theaterMode);
  };

  const handleFullScreenToggle = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
        playerContainerRef.current.requestFullscreen?.()
          .catch(err => console.error(`FS Error: ${err.message}`));
    } else {
        document.exitFullscreen?.()
          .catch(err => console.error(`FS Exit Error: ${err.message}`));
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    // Initial check in case the page loads in fullscreen (e.g. browser refresh)
    setIsFullScreen(!!document.fullscreenElement);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const handleSaveNote = async () => {
    if (!video) return;

    setIsSavingNote(true);
    try {
      await Video.update(video.id, { notes: videoNote });
      toast({
        title: t.notes_saved,
        description: t.your_notes_saved,
      });
      setVideo(prev => ({ ...prev, notes: videoNote }));
    } catch (err) {
      console.error("Error saving notes:", err);
      toast({
        title: t.error_saving_notes,
        description: t.failed_to_save_notes,
        variant: "destructive",
      });
    } finally {
      setIsSavingNote(false);
    }
  };
  
  const PlayerComponent = video?.sourceType === 'upload' || video?.sourceType === 'local' 
    ? Html5VideoPlayer 
    : YouTubePlayer;
  
  const getWatchPageClasses = () => {
    if (isKidsModeActive) {
      return ""; // No specific bg for kids mode, relies on Layout's theme
    }
    return isFullScreen ? 'bg-black text-white' : 'text-foreground'; 
  };
  
  // Class constants for Kids Mode (if needed for specific components within this page)
  const kidsModeCardBgClass = 'bg-card'; 
  const kidsModeMutedFgClass = 'text-muted-foreground';
  const kidsModeAccentTextClass = 'text-primary';
  const kidsModeMutedBgClass = 'bg-muted';
  const kidsModeFgClass = 'text-foreground';
  const kidsModeAccentBgClass = 'bg-primary';

  // Countdown related functions
  const setupNextVideoTimer = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current); // Clear any existing timer
    }
    if (autoplayEnabled && nextVideoInfo) {
      setCountdown(5); // Reset countdown
      setShowNextVideoPreview(true);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            handlePlayNextVideo(nextVideoInfo.id, currentPlaylistId, findNextVideoIndex(nextVideoInfo.id));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const findNextVideoIndex = (nextVideoId) => {
    if (!playlistVideos || playlistVideos.length === 0) return -1;
    return playlistVideos.findIndex(v => v.id === nextVideoId);
  };

  // Define fetchWithRetry helper function inside the component for immediate use
  // The full implementation should go in the ApiUtils.js file but this ensures it's available here
  const fetchWithRetry = async (fn, options = {}) => {
    const { maxRetries = 2, retryDelay = 1000, silent = false } = options;
    let retries = 0;
    
    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (retries >= maxRetries) {
          if (!silent) {
            console.error('API call failed after retries:', error);
          }
          throw error;
        }
        
        // Calculate exponential backoff delay
        const delay = retryDelay * Math.pow(2, retries);
        
        console.warn(`API call failed, retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }
  };

  // Update loading indicator in render
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p>{t.loading_video}</p>
          {loadingProgress > 0 && (
            <div className="w-48 mt-2">
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${loadingProgress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`min-h-screen ${getWatchPageClasses()}`}>
        {isKidsModeActive && <KidsExitButton />}

        {error ? (
          <div className="flex justify-center items-center h-[50vh]">
            <div className="flex flex-col items-center text-center max-w-md p-4">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-bold mb-2">{t.error}</h2>
              <p className="mb-4 text-sm">{error}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t.redirecting_home}
              </p>
              <Button onClick={() => navigate(createPageUrl("Home"))}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t.back_to_home}
              </Button>
            </div>
          </div>
        ) : !video ? (
          <div className="flex justify-center items-center h-[50vh]">
            <div className="flex flex-col items-center text-center max-w-md p-4">
              <Film className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold mb-2">{t.no_video}</h2>
               <p className="mb-4 text-sm text-muted-foreground">{t.no_video_desc}</p>
              <Button onClick={() => navigate(createPageUrl("Home"))}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t.back_to_home}
              </Button>
            </div>
          </div>
        ) : (
          // Main content structure
          <div className={`mx-auto ${theaterMode || isFullScreen ? 'max-w-full px-0' : 'py-4 px-2 md:px-4'}`}>
            <div className={`flex flex-col gap-4 ${isKidsModeActive ? 'pt-8' : ''}`}>
              {/* Player and Controls Wrapper */}
              <div className={`flex-grow ${theaterMode && !isFullScreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
                {/* Player Section */}
                <div 
                  ref={playerContainerRef} 
                  className={`relative group/player 
                    ${isFullScreen ? 'w-screen h-screen fixed inset-0 z-[100] bg-black' : 'w-full aspect-video rounded-lg shadow-xl'}
                    bg-black overflow-hidden`}
                >
                  <PlayerComponent
                    ref={playerRef}
                    sourceType={video.sourceType}
                    videoId={video.videoId}
                    fileUrl={video.fileUrl}
                    localFilePath={video.localFilePath}
                    autoplay={autoplayEnabled} 
                    volume={volume}
                    isMuted={isMuted}
                    onPlayerReady={handlePlayerReady}
                    onVideoEnded={handleVideoEnded}
                    onTimeUpdate={handleTimeUpdate} 
                    onDurationChange={handleDurationChange} 
                    onError={(e) => { console.error("Player Error:", e); setError(t.player_error); }}
                  />
                  
                  {video.sourceType === 'youtube' && (
                    <div className="absolute bottom-0 right-0 z-30 pointer-events-none">
                      <img
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/8298ac3e9_Youtube-Transparent-Image.png"
                        alt="YouTube"
                        className="h-12 w-12 opacity-90"
                        title="Sourced from YouTube"
                      />
                    </div>
                  )}

                  {/* Clickable Overlay to Play/Pause and block clicks on YouTube logo */}
                  {/* This layer sits on top of the video to capture clicks */}
                  {!showNextVideoPreview && (
                    <div 
                      className="absolute inset-0 w-full h-full z-10 cursor-pointer"
                      onClick={handlePlayPause}
                      title={isPlaying ? t.pause : t.play}
                      aria-label={isPlaying ? t.pause : t.play}
                    ></div>
                  )}

                  {/* IN-PLAYER OVERLAYS (Only for fullscreen and next video preview) */}

                  {/* Fullscreen Controls Overlay - ONLY shows when in actual fullscreen */}
                  {isFullScreen && (
                     <div className={`absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 opacity-100 z-20`}>
                       {/* Seek Bar */}
                       <div className="flex items-center gap-2 px-2 mb-1">
                          <span className="text-xs text-white font-mono">{formatTime(currentTime)}</span>
                          <Slider
                            value={[currentTime]}
                            max={duration || 0}
                            step={1}
                            onValueChange={handleSliderValueChange} 
                            onValueCommit={handleSliderCommit}     
                            className="w-full [&>span:first-child]:h-1.5 [&>span:first-child>span]:h-1.5 [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-transparent"
                            disabled={!duration}
                          />
                          <span className="text-xs text-white font-mono">{formatTime(duration)}</span>
                       </div>
                       {/* Control Buttons */}
                       <div className="flex items-center gap-1">
                          {/* Left side controls: prev, play, next */}
                          <div className="flex items-center gap-1">
                            {playlistVideos.length > 0 && currentVideoIndex > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={handlePlayPreviousVideo} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                            <SkipBack className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t.previous_video}</p></TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handlePlayPause} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                        {isPlaying ? 
                                          <Pause className="h-6 w-6" /> : 
                                          <Play className="h-6 w-6" />
                                        }
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{isPlaying ? t.pause : t.play}</p></TooltipContent>
                            </Tooltip>
                             {playlistVideos.length > 0 && currentVideoIndex < playlistVideos.length - 1 && nextVideoInfo && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={() => handlePlayNextVideo(nextVideoInfo.id, currentPlaylistId, findNextVideoIndex(nextVideoInfo.id))} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                            <SkipForward className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t.next_video}</p></TooltipContent>
                                </Tooltip>
                            )}
                          </div>
                          {/* Right side controls: volume, fullscreen toggle */}
                          <div className="flex items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={handleMuteToggle} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                        {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{isMuted || volume === 0 ? t.unmute : t.mute}</p></TooltipContent>
                            </Tooltip>
                            <Slider
                                value={[volume * 100]}
                                max={100}
                                step={1}
                                onValueChange={handleVolumeChange}
                                className="w-20 hidden sm:flex [&>span:first-child]:h-1 [&>span:first-child>span]:h-1 [&_[role=slider]]:w-2.5 [&_[role=slider]]:h-2.5"
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                               <Button onClick={handleFullScreenToggle} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                  {isFullScreen ? <Minimize className="h-5 w-5" /> : <Fullscreen className="h-5 w-5" />}
                               </Button>
                              </TooltipTrigger>
                              <TooltipContent>{isFullScreen ? t.exit_fullscreen : t.fullscreen}</TooltipContent>
                            </Tooltip>
                          </div>
                       </div>
                    </div>
                  )}

                  {/* Next Video Preview Overlay (if applicable) - Stays as an overlay */}
                  {showNextVideoPreview && nextVideoInfo && (
                   <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 p-4">
                    <p className="text-xl text-white mb-1">{t.up_next}</p>
                    <img 
                        src={nextVideoInfo.thumbnail || (nextVideoInfo.sourceType === 'youtube' && nextVideoInfo.videoId ? `https://img.youtube.com/vi/${nextVideoInfo.videoId}/mqdefault.jpg` : '')} 
                        alt={nextVideoInfo.title} 
                        className="w-48 h-28 object-cover rounded-md shadow-lg mb-3"
                    />
                    <h3 className="text-lg font-semibold text-white mb-3 text-center line-clamp-2">{nextVideoInfo.title}</h3>
                    <div className="flex items-center space-x-3">
                        <Button variant="ghost" onClick={() => { setShowNextVideoPreview(false); if(countdownRef.current) clearInterval(countdownRef.current); }} className="text-white hover:bg-white/10">
                            {t.cancel}
                        </Button>
                        <Button 
                            onClick={() => handlePlayNextVideo(nextVideoInfo.id, currentPlaylistId, findNextVideoIndex(nextVideoInfo.id))}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {t.play_now} ({countdown})
                        </Button>
                    </div>
                  </div>
                )}
                </div>

                {/* DEDICATED CONTROL BAR (Below Player) - Hides in Fullscreen mode */}
                {!isFullScreen && (
                  <div className={`mt-2 p-2 rounded-b-lg bg-muted`}>
                    {/* Unified Controls for all modes */}
                      <>
                        <div className="flex items-center gap-3 px-2 mb-2">
                          <span className="text-xs text-muted-foreground font-mono">{formatTime(currentTime)}</span>
                          <Slider
                            value={[currentTime]}
                            max={duration || 0}
                            step={1}
                            onValueChange={handleSliderValueChange} 
                            onValueCommit={handleSliderCommit}     
                            className="w-full"
                            disabled={!duration}
                          />
                          <span className="text-xs text-muted-foreground font-mono">{formatTime(duration)}</span>
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <div className="flex items-center gap-1">
                            {playlistVideos.length > 0 && currentVideoIndex > 0 && (
                                <Tooltip><TooltipTrigger asChild><Button onClick={handlePlayPreviousVideo} variant="ghost" size="icon"><SkipBack className="h-5 w-5 text-foreground" /></Button></TooltipTrigger><TooltipContent><p>{t.previous_video}</p></TooltipContent></Tooltip>
                            )}
                            <Tooltip><TooltipTrigger asChild><Button onClick={handlePlayPause} variant="ghost" size="icon">{isPlaying ? <Pause className="h-6 w-6 text-foreground" /> : <Play className="h-6 w-6 text-foreground" />}</Button></TooltipTrigger><TooltipContent><p>{isPlaying ? t.pause : t.play}</p></TooltipContent></Tooltip>
                             {playlistVideos.length > 0 && currentVideoIndex < playlistVideos.length - 1 && nextVideoInfo && (
                                <Tooltip><TooltipTrigger asChild><Button onClick={() => handlePlayNextVideo(nextVideoInfo.id, currentPlaylistId, findNextVideoIndex(nextVideoInfo.id))} variant="ghost" size="icon"><SkipForward className="h-5 w-5 text-foreground" /></Button></TooltipTrigger><TooltipContent><p>{t.next_video}</p></TooltipContent></Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Tooltip><TooltipTrigger asChild><Button onClick={handleMuteToggle} variant="ghost" size="icon">{isMuted || volume === 0 ? <VolumeX className="h-5 w-5 text-foreground" /> : <Volume2 className="h-5 w-5 text-foreground" />}</Button></TooltipTrigger><TooltipContent><p>{isMuted || volume === 0 ? t.unmute : t.mute}</p></TooltipContent></Tooltip>
                            <Slider value={[volume * 100]} max={100} step={1} onValueChange={handleVolumeChange} className="w-24 hidden sm:flex" />
                            <Tooltip><TooltipTrigger asChild><Button onClick={handleFullScreenToggle} variant="ghost" size="icon">{isFullScreen ? <Minimize className="h-5 w-5 text-foreground" /> : <Fullscreen className="h-5 w-5 text-foreground" />}</Button></TooltipTrigger><TooltipContent>{isFullScreen ? t.exit_fullscreen : t.fullscreen}</TooltipContent></Tooltip>
                          </div>
                        </div>
                      </>
                  </div>
                )}
              </div>

              {/* Player Controls (Theater/Fullscreen toggle bar) - Only if not fullscreen and not kids mode */}
              {!isFullScreen && !isKidsModeActive && (
                <div className={`flex justify-between items-center ${theaterMode ? 'max-w-4xl mx-auto w-full px-2' : 'px-0'} mt-0 mb-0`}>
                    <div className="flex-1 min-w-0">
                        {/* Title removed from here to consolidate with main details below */}
                        {!theaterMode && (
                             <h2 className="text-lg font-semibold truncate text-foreground">
                                {video.title || t.untitled_video}
                             </h2>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Favorite button moved to main video details section below */}

                        <Switch
                            checked={autoplayEnabled}
                            onCheckedChange={toggleAutoplay}
                            id="autoplay-switch"
                        />
                        <Label htmlFor="autoplay-switch" className="text-sm text-muted-foreground">{t.autoplay}</Label>
                        
                        <Button variant="outline" size="sm" onClick={toggleTheaterMode}>
                            {theaterMode ? <Minimize className="h-4 w-4 mr-2" /> : <Maximize className="h-4 w-4 mr-2" />}
                            {theaterMode ? t.default_view : t.theater_mode}
                        </Button>
                    </div>
                </div>
              )}

              {/* Horizontal Playlist Carousel - Only if not fullscreen and playlist videos exist */}
              {!isFullScreen && playlistVideos && playlistVideos.length > 0 && (
                <div className={`px-0 md:px-0 ${isKidsModeActive ? 'pb-12' : 'pb-0'} ${theaterMode ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
                  <div className="mb-4 flex justify-between items-center">
                    <h3 className="text-xl font-semibold">
                      {currentPlaylistName ? 
                        `${t.playing_from}: ${currentPlaylistName}` : 
                        t.up_next}
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={scrollLeft}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={scrollRight}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea ref={scrollAreaRef} className="w-full whitespace-nowrap rounded-md pb-4">
                    <div className="flex space-x-4">
                      {playlistVideos.map((item, index) => (
                        <VideoCard
                          key={item.id}
                          video={item}
                          size="small"
                          className={`w-[200px] md:w-[240px] flex-shrink-0 ${item.id === video.id ? 'border-2 border-primary shadow-lg' : ''}`}
                          onClick={() => handlePlayNextVideo(item.id, currentPlaylistId, index)}
                          showContextMenu={false}
                        />
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              )}

              {/* Video Details and Up Next Tabs/List - Only if not fullscreen */}
              {!isFullScreen && (
                <div className={`py-3 px-1 flex flex-col lg:flex-row gap-6 ${theaterMode && !isKidsModeActive ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
                  {/* Left Column: Title, Description, Notes */}
                  <div className="flex-grow min-w-0 lg:w-2/3">
                    {!theaterMode && (
                      <h2 className="text-2xl font-bold mb-1 text-foreground line-clamp-2">{video.title || t.untitled_video}</h2>
                    )}
                    {video.channelTitle && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {t.by}: <span className="font-medium text-foreground">{video.channelTitle}</span>
                      </p>
                    )}
                    
                    {/* Favorite Button and Kid-Friendly Badge (moved/added here) */}
                    <div className="flex items-center gap-2 mb-4">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleToggleFavorite}
                                    className={`hover:text-destructive ${video.favorite ? "text-destructive border-destructive hover:bg-destructive/10" : "text-muted-foreground"}`}
                                >
                                    <Heart className={`h-4 w-4 mr-2 ${video.favorite ? "fill-destructive" : ""}`} />
                                    {video.favorite ? t.unfavorite : t.favorite}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {video.favorite ? t.remove_from_favorites : t.add_to_favorites}
                            </TooltipContent>
                        </Tooltip>

                        {video.kidFriendly && (
                            <div className="flex items-center text-sm text-green-600 bg-green-100 px-3 py-1.5 rounded-md border border-green-200">
                                <Users className="h-4 w-4 mr-2" />
                                <span>{t.kids_mode_approved}</span>
                            </div>
                        )}
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="description">{t.description}</TabsTrigger>
                        <TabsTrigger value="notes">{t.notes}</TabsTrigger>
                      </TabsList>
                      <TabsContent value="description">
                        <Card className={`${isKidsModeActive ? kidsModeCardBgClass : ''}`}>
                          <CardContent className="pt-6">
                             <p className={`text-sm ${isKidsModeActive ? kidsModeFgClass : 'text-foreground/80'} whitespace-pre-wrap break-words`}>
                                {video.description || t.no_description_available}
                             </p>
                          </CardContent>
                        </Card>
                      </TabsContent>
                      <TabsContent value="notes">
                         <Card className={`${isKidsModeActive ? kidsModeCardBgClass : ''}`}>
                          <CardContent className="pt-6 space-y-3">
                            <Textarea
                              placeholder={t.add_your_notes_here}
                              value={videoNote}
                              onChange={(e) => setVideoNote(e.target.value)}
                              rows={5}
                              className={`w-full ${isKidsModeActive ? `${kidsModeMutedBgClass} ${kidsModeFgClass}` : ''}`}
                            />
                            <Button onClick={handleSaveNote} disabled={isSavingNote} className={`${isKidsModeActive ? `${kidsModeAccentBgClass} hover:${kidsModeAccentBgClass}/90` : ''}`}>
                              {isSavingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                              {t.save_notes}
                            </Button>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Right Column: Up Next List - only if not kids mode and suggestions exist */}
                  {!isKidsModeActive && playlistSuggestions && playlistSuggestions.length > 0 && (
                    <div className="lg:w-1/3 flex-shrink-0">
                      <h3 className="text-lg font-semibold mb-3">{t.up_next}</h3>
                      <ScrollArea className="h-[calc(18rem+100px)] pr-2"> {/* Adjusted height */}
                        <div className="space-y-3">
                          {playlistSuggestions.map((suggestion, index) => (
                            <div 
                              key={suggestion.id} 
                              className="flex items-start space-x-3 p-2 hover:bg-muted rounded-lg cursor-pointer"
                              onClick={() => handlePlayNextVideo(suggestion.id, currentPlaylistId, playlistVideos.findIndex(v=>v.id === suggestion.id) )}
                            >
                              <img 
                                src={suggestion.thumbnail || (suggestion.sourceType === 'youtube' && suggestion.videoId ? `https://img.youtube.com/vi/${suggestion.videoId}/default.jpg` : 'https://via.placeholder.com/120x90?text=No+Thumb')} 
                                alt={suggestion.title} 
                                className="w-24 h-16 object-cover rounded-md flex-shrink-0"
                              />
                              <div className="flex-grow min-w-0">
                                <p className="text-sm font-medium line-clamp-2">{suggestion.title || t.untitled_video}</p>
                                {suggestion.channelTitle && <p className="text-xs text-muted-foreground line-clamp-1">{suggestion.channelTitle}</p>}
                                {suggestion.duration && <p className="text-xs text-muted-foreground">{suggestion.duration}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

