import React, { useState, useEffect, useRef } from "react";
import { Playlist } from "@/entities/Playlist";
import { Video } from "@/entities/Video";
import { Photo } from "@/entities/Photo";
import { Album } from "@/entities/Album";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Film, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useTranslation } from "../components/LanguageProvider";
import KidsExitButton from "../components/KidsExitButton";
import KidsAlbumCard from "@/components/KidsAlbumCard";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function Kids() {
  // Renamed state variables for consistency with outline
  const [playlists, setPlaylists] = useState([]); // Formerly kidFriendlyPlaylists
  const [videos, setVideos] = useState([]); // Formerly allKidFriendlyVideos

  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistVideos, setPlaylistVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  // showFilters state is not used in the provided code, but keeping it as it was not explicitly marked for removal
  const [showFilters, setShowFilters] = useState(false);

  // NEW: State for photos and kid-friendly albums
  const [photos, setPhotos] = useState([]);
  const [kidFriendlyAlbums, setKidFriendlyAlbums] = useState([]);

  // NEW: State for selected color theme
  const [selectedColor, setSelectedColor] = useState('teal'); // Default to teal

  // New state for parent code setup
  const [showCodeSetup, setShowCodeSetup] = useState(false);
  const [parentCode, setParentCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Color theme configurations with fun patterns
  const colorThemes = {
    teal: {
      name: t.color_teal || 'Ocean',
      bgColor: 'bg-teal-500',
      pattern: 'linear-gradient(135deg, #1abc9c, #2ecc71, #3498db)',
      patternOverlay: 'radial-gradient(circle at 20% 80%, rgba(120, 255, 214, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.2) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(34, 197, 94, 0.2) 0%, transparent 50%)',
      buttonColor: 'bg-teal-600 hover:bg-teal-700',
      buttonOutline: 'bg-white/80 hover:bg-teal-50 text-teal-700 border-teal-300',
      textColor: 'text-teal-800',
      icon: '🌊'
    },
    blue: {
      name: t.color_blue || 'Sky',
      bgColor: 'bg-blue-500',
      pattern: 'linear-gradient(135deg, #3498db, #8e44ad, #2980b9)',
      patternOverlay: 'radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 200, 255, 0.4) 0%, transparent 60%), linear-gradient(45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.1) 75%)',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      buttonOutline: 'bg-white/80 hover:bg-blue-50 text-blue-700 border-blue-300',
      textColor: 'text-blue-800',
      icon: '☁️'
    },
    pink: {
      name: t.color_pink || 'Sunset',
      bgColor: 'bg-pink-400',
      pattern: 'linear-gradient(135deg, #ff7e5f, #feb47b, #ff5733)',
      patternOverlay: 'radial-gradient(circle at 30% 70%, rgba(255, 182, 193, 0.4) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 50%), repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0px, rgba(255, 255, 255, 0.1) 2px, transparent 2px, transparent 20px)',
      buttonColor: 'bg-pink-500 hover:bg-pink-600',
      buttonOutline: 'bg-white/80 hover:bg-pink-50 text-pink-700 border-pink-300',
      textColor: 'text-pink-800',
      icon: '🌸'
    },
    white: {
      name: t.color_white || 'Cloud',
      bgColor: 'bg-gray-100',
      pattern: 'linear-gradient(135deg, #f0f0f0, #ffffff, #e0e0e0)',
      patternOverlay: 'radial-gradient(circle at 40% 60%, rgba(34, 197, 94, 0.1) 0%, transparent 50%), radial-gradient(circle at 60% 40%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 20% 20%, rgba(249, 115, 22, 0.1) 0%, transparent 50%)',
      buttonColor: 'bg-gray-600 hover:bg-gray-700 text-white',
      buttonOutline: 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-md',
      textColor: 'text-gray-800',
      icon: '☁️'
    }
  };

  const currentTheme = colorThemes[selectedColor];

  useEffect(() => {
    document.body.classList.add('kids-mode-active');

    // Check if an exit code is already set
    const existingCode = sessionStorage.getItem('kids-mode-exit-code');
    if (!existingCode) {
      // No code set, show setup dialog
      setShowCodeSetup(true);
    }
    
    // Load saved color preference
    const savedColor = localStorage.getItem('kids-mode-color') || 'teal';
    setSelectedColor(savedColor);

    // Call the renamed content loading function
    loadKidsContent();
    return () => {
      document.body.classList.remove('kids-mode-active');
    };
  }, []);

  // NEW: useEffect to handle back navigation locking
  useEffect(() => {
    // Push an initial state to the history when entering kids mode
    window.history.pushState(null, "", window.location.href);

    const handlePopState = (event) => {
      // When the user tries to navigate back, push the state again to keep them on the page
      window.history.pushState(null, "", window.location.href);
      
      // Inform the user why they can't go back
      toast({
          title: t.exit_protected_title || "Exit Protected",
          description: t.exit_protected_desc || "Please use the 'Exit Kids Mode' button.",
      });
    };

    window.addEventListener("popstate", handlePopState);

    // This cleanup is crucial: it removes the lock when the component unmounts (e.g., after a successful exit)
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [t, toast]); // Dependencies for the effect

  useEffect(() => {
    if (selectedPlaylist) {
      // Added 'videos' as a dependency to ensure playlist videos re-filter if 'videos' changes
      loadPlaylistVideos(selectedPlaylist);
    }
  }, [selectedPlaylist, videos]); // Added 'videos' dependency

  // Renamed content loading function from loadKidsFriendlyContent
  const loadKidsContent = async () => {
    setLoading(true);
    try {
      // Use Promise.all to fetch all data concurrently for better performance
      const [videosData, playlistsData, photosData, albumsData] = await Promise.all([
        Video.list(),
        Playlist.list(),
        Photo.list(),
        Album.list()
      ]);

      // Filter and set video data
      setVideos(videosData?.filter(video => video.kidFriendly) || []);

      // Filter and set playlist data
      const kidPlaylists = playlistsData?.filter(playlist => playlist.isKidFriendly) || [];
      setPlaylists(kidPlaylists);

      // Set photo data
      setPhotos(photosData || []);

      // Filter and set kid-friendly album data
      setKidFriendlyAlbums(albumsData?.filter(album => album.isKidFriendly) || []);

      // Set the initial selected playlist
      if (kidPlaylists.length > 0) {
        setSelectedPlaylist(kidPlaylists[0]);
      }
    } catch (error) {
      console.error("Error loading kids content:", error);
      // Display a toast notification on error
      toast({
        title: "Error",
        description: "Could not load kids content",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylistVideos = async (playlist) => {
    if (!playlist || !playlist.videoIds || playlist.videoIds.length === 0) {
      setPlaylistVideos([]);
      return;
    }

    try {
      // Use the pre-loaded 'videos' state instead of fetching again
      if (videos.length > 0) {
        // Filter videos that are in the playlist AND marked as kidFriendly
        const filteredVideos = videos.filter(v => 
          playlist.videoIds.includes(v.id)
        );
        setPlaylistVideos(filteredVideos);
      } else {
        // Fallback if 'videos' state is empty (though Promise.all should prevent this)
        const allVideos = await Video.list();
        const fallbackVideos = allVideos.filter(v =>
          playlist.videoIds.includes(v.id) && v.kidFriendly
        );
        setPlaylistVideos(fallbackVideos);
      }
    } catch (error) {
      console.error("Error loading playlist videos:", error);
      setPlaylistVideos([]);
    }
  };

  const handleWatchVideo = (videoId, playlistId) => {
    navigate(`${createPageUrl("Watch")}?id=${videoId}&playlistId=${playlistId}&kids=true`);
  };

  const handleColorChange = (color) => {
    setSelectedColor(color);
    localStorage.setItem('kids-mode-color', color);
  };

  const handleCodeSetup = () => {
    setCodeError('');
    
    if (!parentCode.trim()) {
      setCodeError(t.code_required || "Please enter a code");
      return;
    }
    
    if (parentCode.length < 3) {
      setCodeError(t.code_too_short || "Code must be at least 3 characters");
      return;
    }
    
    if (parentCode !== confirmCode) {
      setCodeError(t.codes_dont_match || "Codes don't match");
      return;
    }
    
    // Save the code to sessionStorage
    sessionStorage.setItem('kids-mode-exit-code', parentCode);
    
    toast({
      title: t.exit_code_set || "Exit Code Set",
      description: t.exit_code_set_desc || "Remember this code to exit Kids Mode later.",
    });
    
    setShowCodeSetup(false);
    setParentCode('');
    setConfirmCode('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {/* Code Setup Dialog */}
      <Dialog open={showCodeSetup} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[400px]" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Lock className="h-6 w-6 text-blue-600" />
              <div>
                <DialogTitle className="text-xl">
                  {t.set_exit_code || "Set Exit Code"}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 mt-1">
                  {t.set_exit_code_desc || "Set a code that will be required to exit Kids Mode"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t.enter_exit_code || "Enter Exit Code"}
              </label>
              <Input
                type="password"
                placeholder={t.choose_exit_code || "Choose a code"}
                value={parentCode}
                onChange={(e) => setParentCode(e.target.value)}
                className="text-center"
                maxLength={20}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t.confirm_exit_code || "Confirm Exit Code"}
              </label>
              <Input
                type="password"
                placeholder={t.confirm_code_again || "Enter code again"}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCodeSetup()}
                className="text-center"
                maxLength={20}
              />
            </div>
            
            {codeError && (
              <div className="text-sm text-red-600 text-center">
                {codeError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              onClick={handleCodeSetup}
              disabled={!parentCode || !confirmCode}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {t.set_code || "Set Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Kids Mode Content */}
      <div
        className={`flex flex-col min-h-screen text-white relative overflow-hidden`}
        style={{
          background: currentTheme.pattern,
        }}
      >
        {/* Fun pattern overlay */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: currentTheme.patternOverlay,
          }}
        ></div>

        {/* Content wrapper with relative positioning */}
        <div className="relative z-10 flex flex-col min-h-screen">
          <KidsExitButton />

          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            <div className="text-center mb-8 mt-8">
              <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 drop-shadow-lg">
                {t.kids_mode_title || "Kids Safe Zone"}
              </h1>

              {/* Color Picker */}
              <div className="flex justify-center mb-8">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
                  <p className="text-gray-700 text-sm font-medium mb-3">{t.choose_your_color || "Choose Your Color!"}</p>
                  <div className="flex gap-3 justify-center">
                    {Object.entries(colorThemes).map(([key, theme]) => (
                      <button
                        key={key}
                        onClick={() => handleColorChange(key)}
                        className={`relative w-12 h-12 rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${
                          selectedColor === key ? 'ring-4 ring-white ring-offset-2 ring-offset-transparent scale-110' : ''
                        }`}
                        style={{
                          background: theme.pattern,
                        }}
                        title={theme.name}
                      >
                        <span className="text-lg">{theme.icon}</span>
                        {selectedColor === key && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-md">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="container mx-auto">
              {/* Conditional rendering for no content, now checking albums too */}
              {playlists.length === 0 && videos.length === 0 && kidFriendlyAlbums.length === 0 ? (
                <div className="text-center py-20 bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl max-w-lg mx-auto">
                  <AlertTriangle className="mx-auto h-24 w-24 text-yellow-400 mb-6" />
                  <h2 className="text-3xl font-semibold mb-4 text-gray-700">
                    {t.no_kids_content || "No Kids Content Yet"}
                  </h2>
                  <p className="text-lg text-gray-600 mb-8 px-6">
                    {t.ask_grownup_add_content || "It looks like there are no kid-friendly videos, playlists, or albums yet. Ask a grown-up to add some kid-friendly content for you!"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Playlists Section */}
                  {playlists.length > 0 && (
                    <div className="mb-12">
                      <div className="flex flex-wrap justify-center gap-3 mb-8">
                        {playlists.map(playlist => (
                          <Button
                            key={playlist.id}
                            variant={selectedPlaylist?.id === playlist.id ? "default" : "outline"}
                            onClick={() => setSelectedPlaylist(playlist)}
                            className={`
                              ${selectedPlaylist?.id === playlist.id
                                ? `${currentTheme.buttonColor} text-white border-transparent`
                                : currentTheme.buttonOutline}
                              transition-all duration-200 rounded-lg px-4 py-2 shadow-md hover:shadow-lg
                            `}
                          >
                            {playlist.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Videos in selected playlist section */}
                  {selectedPlaylist && (
                    <div className="mb-12">
                      {playlistVideos.length === 0 ? (
                        <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
                          <Film className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                          <p className="text-gray-600 text-lg">{t.playlist_empty || "This playlist is empty."}</p>
                          <p className="text-gray-500 text-sm">{t.ask_add_videos || "Ask a grown-up to add videos to this playlist."}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {playlistVideos.map(video => (
                            <Card
                              key={video.id}
                              className={`overflow-hidden group cursor-pointer transform hover:scale-105 transition-transform duration-300 shadow-lg hover:shadow-xl rounded-xl border-2 border-transparent hover:border-white bg-white/90`}
                              onClick={() => handleWatchVideo(video.id, selectedPlaylist.id)}
                            >
                              <div className="aspect-video relative">
                                <img
                                  src={video.thumbnail || (video.sourceType === 'youtube' && video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : '')}
                                  alt={video.title}
                                  className="w-full h-full object-cover rounded-t-lg"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <Film className="h-12 w-12 text-white/80" />
                                </div>
                              </div>
                              <div className="p-3">
                                <h4 className={`font-semibold text-sm line-clamp-2 ${currentTheme.textColor} group-hover:text-gray-800 transition-colors`}>
                                  {video.title}
                                </h4>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Photo Albums Section - NEW */}
                  <div className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className={`text-2xl font-bold ${currentTheme.textColor} flex items-center gap-2`}>
                        {t.photo_albums_heading || "Photo Albums"}
                      </h2>
                    </div>

                    {kidFriendlyAlbums.length === 0 ? (
                      <div className="text-center py-12 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border-2 border-dashed border-yellow-200">
                        <div className="text-6xl mb-4">📸</div>
                        <h3 className="text-xl font-bold text-yellow-800 mb-2">
                          {t.no_photo_albums_yet || "No Photo Albums Yet"}
                        </h3>
                        <p className="text-yellow-600 max-w-md mx-auto">
                          {t.ask_grownup_add_photo_albums || "Ask a grown-up to add some photo albums to your safe zone!"}
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {kidFriendlyAlbums.map(album => (
                          <KidsAlbumCard key={album.id} album={album} photos={photos} selectedColor={selectedColor} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
