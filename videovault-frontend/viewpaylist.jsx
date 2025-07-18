import React, { useState, useEffect } from "react";
import { Playlist } from "@/entities/Playlist";
import { Video } from "@/entities/Video";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { VideoIdCache } from "../components/VideoIdCache";
import VideoCard from "./VideoCard";
import VideoForm from "../components/VideoForm"; // Import VideoForm
import AddToPlaylistDialog from "../components/AddToPlaylistDialog"; // Import AddToPlaylistDialog
import FunLoader from '../components/FunLoader'; // Import FunLoader
import {
  ChevronLeft,
  Share2,
  AlertTriangle,
  ListVideo,
  Plus,
  X,
  Trash2,
  // Play,
  // Shuffle,
  MoreVertical,
  Star,
  Users,
  ListFilter, // Added for Manage Videos button
  Bookmark, // Make sure Bookmark is imported if not already
  CheckSquare, // Added for select videos icon
  UserX // Added for remove from kids mode icon
} from "lucide-react";
import SharePlaylistDialog from "../components/SharePlaylistDialog";
import { useTranslation } from "../components/LanguageProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

// Improved video fetching with better error handling
const fetchVideoDetails = async (videoIds, batchSize = 3) => {
  const results = [];
  const validIds = [];
  const temporarilyUnavailable = [];

  // Filter out permanently invalid IDs, but include temporarily failing ones for retry
  const idsToFetch = videoIds.filter(id => {
    if (VideoIdCache.isInvalidId(id)) return false;
    
    // Include temporarily failing IDs for retry, but with lower priority
    if (VideoIdCache.isTemporarilyFailing(id)) {
      temporarilyUnavailable.push(id);
      return false; // Don't process in the main batch
    }
    
    return true; // Process in the main batch
  });

  // Process main batch first
  for (let i = 0; i < idsToFetch.length; i += batchSize) {
    const batch = idsToFetch.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(batch.map(async (videoId, index) => {
      try {
        // Stagger requests within the batch
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 300 * index));
        }
        
        const video = await Video.get(videoId);
        if (video) {
          VideoIdCache.cacheVideo(videoId, video); // Cache successfully fetched video
          validIds.push(videoId);
          return video;
        } else {
          // If Video.get returns null/undefined (e.g., object not found)
          VideoIdCache.markAsTemporaryFail(videoId, 'not_found');
          return null;
        }
      } catch (error) {
        console.warn(`Failed to fetch video ${videoId}:`, error);
        
        if (error.message?.includes('Rate limit exceeded')) {
          VideoIdCache.markAsTemporaryFail(videoId, 'rate_limit');
          // For rate limits, keep the video ID as valid for now, it's a temporary API issue
          validIds.push(videoId); 
          return null;
        } else if (error.message?.includes('Object not found') || 
                   error.message?.includes('ObjectNotFoundError') ||
                   error.message?.includes('not found')) {
          VideoIdCache.markAsTemporaryFail(videoId, 'not_found');
        } else {
          VideoIdCache.markAsTemporaryFail(videoId, 'network_error');
          // For network errors, keep as valid, it's a temporary connection issue
          validIds.push(videoId);
        }
        return null;
      }
    }));

    results.push(...batchResults.filter(Boolean));

    // Delay between batches
    if (i + batchSize < idsToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Retry temporarily unavailable videos with longer delays
  if (temporarilyUnavailable.length > 0) {
    console.log(`Retrying ${temporarilyUnavailable.length} temporarily unavailable videos...`);
    
    for (const videoId of temporarilyUnavailable.slice(0, 3)) { // Limit retries to first 3
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay per retry
        const video = await Video.get(videoId);
        if (video) {
          VideoIdCache.cacheVideo(videoId, video); // Cache successfully fetched video on retry
          results.push(video);
          validIds.push(videoId);
        } else {
          // Even if retry fails (e.g., video still not found), include it in validIds
          // to prevent removal, assuming it's a temporary issue.
          validIds.push(videoId);
        }
      } catch (error) {
        console.warn(`Retry failed for video ${videoId}:`, error);
        // If retry also fails, keep as valid for now (don't remove from playlist)
        validIds.push(videoId);
      }
    }
    
    // Add remaining temporarily unavailable IDs that were not retried (due to limit) as valid.
    // This ensures they are not removed from the playlist based on this session's failures.
    validIds.push(...temporarilyUnavailable.slice(3));
  }

  return { videos: results, validIds };
};

export default function ViewPlaylist() {
  const { t, language } = useTranslation();
  const urlParams = new URLSearchParams(window.location.search);
  const playlistId = urlParams.get('id');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [playlist, setPlaylist] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);

  // Add state for managing videos with expanded options
  const [isRandomPlay, setIsRandomPlay] = useState(false);

  // State for VideoForm
  const [editingVideo, setEditingVideo] = useState(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [allCategoriesForEdit, setAllCategoriesForEdit] = useState([]);


  // State for AddToPlaylistDialog
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [videoToAddToPlaylist, setVideoToAddToPlaylist] = useState(null);
  const [allPlaylists, setAllPlaylists] = useState([]);

  useEffect(() => {
    if (playlistId) {
      loadPlaylist();
      loadAllPlaylists(); // Load all playlists for the "Add to Playlist" dialog
      loadAllCategories(); // Load categories for edit form
    }
  }, [playlistId]);

  const loadAllCategories = async () => {
    try {
      const allVideos = await Video.list();
      const uniqueCategories = allVideos
        .map(v => v.category)
        .filter(Boolean)
        .reduce((acc, curr) => acc.includes(curr) ? acc : [...acc, curr], []);
      setAllCategoriesForEdit(uniqueCategories);
    } catch (catError) {
      console.error("Error loading categories:", catError);
    }
  };

  const loadPlaylist = async () => {
    if (!playlistId) {
      setError("No playlist ID provided");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const playlistData = await Playlist.get(playlistId);
      if (!playlistData) {
        setError("Playlist not found");
        setLoading(false);
        return;
      }

      setPlaylist(playlistData);

      if (!playlistData.videoIds || playlistData.videoIds.length === 0) {
        setVideos([]);
        setLoading(false);
        return;
      }

      // Use smaller batch size for initial load to be more conservative
      const { videos: validVideos, validIds } = await fetchVideoDetails(playlistData.videoIds, 2); // Explicitly set batchSize to 2

      // Only update playlist if significantly different (more than 10% of videos removed)
      const removalThreshold = Math.floor(playlistData.videoIds.length * 0.1);
      const removedCount = playlistData.videoIds.length - validIds.length;
      
      if (removedCount > removalThreshold && removedCount > 2) {
        console.warn(`Many videos (${removedCount}) were filtered out. Not auto-updating playlist to prevent data loss.`);
        
        // Show a warning to the user
        toast({
          title: t("some_videos_temp_unavailable_title"), // "Some videos temporarily unavailable"
          description: t("some_videos_temp_unavailable_desc", { removedCount }), // `${removedCount} videos couldn't be loaded. They will be retried later.`
          variant: "destructive",
          duration: 8000,
        });
      } else if (validIds.length !== playlistData.videoIds.length) {
        try {
          await Playlist.update(playlistId, {
            ...playlistData,
            videoIds: validIds
          });
        } catch (updateError) {
          console.error("Error updating playlist with valid video IDs:", updateError);
        }
      }

      setVideos(validVideos);
    } catch (error) {
      console.error("Error loading playlist:", error);
      if (error.message?.includes('Rate limit exceeded')) { // Specific error message for rate limit
        setError("Loading too fast - please wait a moment and try again");
      } else {
        setError("Error loading playlist data");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAllPlaylists = async () => {
    try {
      const playlistsData = await Playlist.list();
      setAllPlaylists(playlistsData);
    } catch (error) {
      console.error("Error loading all playlists:", error);
    }
  };

  const handleSharePlaylist = async () => {
    if (!playlist) return;

    try {
      // Create share code if not exists
      if (!playlist.shareCode) {
        const updatedPlaylist = await Playlist.update(playlist.id, {
          ...playlist,
          shareCode: Math.random().toString(36).substring(2, 15),
          isShared: true
        });
        setPlaylist(updatedPlaylist);
      }

      // Generate share URL
      const shareUrl = `${window.location.origin}${createPageUrl("Share")}?code=${playlist.shareCode || playlist.id}`;
      setShareUrl(shareUrl);
      setShowShareDialog(true);
    } catch (error) {
      console.error("Error sharing playlist:", error);
      toast({
        title: t.error,
        description: t.could_not_share_playlist,
        variant: "destructive"
      });
    }
  };

  const handleSelectVideo = (video) => {
    setSelectedVideos(prev => {
      const isSelected = prev.some(v => v.id === video.id);
      if (isSelected) {
        return prev.filter(v => v.id !== video.id);
      } else {
        return [...prev, video];
      }
    });
  };

  const handleRemoveSelected = async () => {
    if (!selectedVideos.length) return;

    try {
      const updatedVideoIds = playlist.videoIds.filter(
        id => !selectedVideos.some(video => video.id === id)
      );

      await Playlist.update(playlist.id, {
        ...playlist,
        videoIds: updatedVideoIds
      });

      toast({
        title: t.videos_removed,
        description: `${selectedVideos.length} ${t.videos_removed_from_playlist}`
      });

      setSelectedVideos([]);
      setIsSelectMode(false);
      loadPlaylist();
    } catch (error) {
      console.error("Error removing videos:", error);
      toast({
        title: t.error,
        description: t.could_not_remove_videos,
        variant: "destructive"
      });
    }
  };

  // Handlers for VideoCard actions
  const handleEditVideo = (video) => {
    setEditingVideo(video);
    setIsEditFormOpen(true);
  };

  const handleVideoSaved = () => {
    setIsEditFormOpen(false);
    setEditingVideo(null);
    loadPlaylist(); // Refresh playlist videos
    loadAllCategories(); // Refresh categories in case a new one was added
  };

  const handleToggleFavorite = async (video) => {
    try {
      await Video.update(video.id, { favorite: !video.favorite });
      // Update video in local state to reflect change immediately
      setVideos(prevVideos =>
        prevVideos.map(v => v.id === video.id ? { ...v, favorite: !v.favorite } : v)
      );
      toast({
        title: video.favorite ? t.removed_from_favorites : t.favorite,
      });
    } catch (error) {
      console.error("Error updating favorite status:", error);
      toast({
        title: t.error,
        description: t.error_updating_status,
        variant: "destructive",
      });
    }
  };

  const handleToggleWatchLater = async (video) => {
    try {
      // Toggle between 'watch-later' and null/undefined (which implies 'in-progress' or not specifically marked)
      const newStatus = video.watchStatus === 'watch-later' ? null : 'watch-later';
      await Video.update(video.id, { watchStatus: newStatus });
      setVideos(prevVideos =>
        prevVideos.map(v => v.id === video.id ? { ...v, watchStatus: newStatus } : v)
      );
      toast({
        title: newStatus === 'watch-later'
          ? t.added_to_watch_later
          : t.removed_from_watch_later,
      });
    } catch (error) {
      console.error("Error updating watch later status:", error);
      toast({
        title: t.error,
        description: t.error_updating_status,
        variant: "destructive",
      });
    }
  };

  const handleToggleKidFriendly = async (video) => {
    try {
      await Video.update(video.id, { kidFriendly: !video.kidFriendly });
      setVideos(prevVideos =>
        prevVideos.map(v => v.id === video.id ? { ...v, kidFriendly: !v.kidFriendly } : v)
      );
      toast({
        title: video.kidFriendly ? t.remove_from_kids_mode : t.add_to_kids_mode,
      });
    } catch (error) {
      console.error("Error updating kid-friendly status:", error);
      toast({
        title: t.error,
        description: t.error_updating_status,
        variant: "destructive",
      });
    }
  };

  const handleOpenAddToPlaylistDialog = (video) => {
    setVideoToAddToPlaylist(video);
    setIsAddToPlaylistOpen(true);
  };

  const handleVideoAddedToPlaylist = () => {
    setIsAddToPlaylistOpen(false);
    setVideoToAddToPlaylist(null);
    // No need to reload playlist here, as we are adding to OTHER playlists
    loadAllPlaylists(); // Refresh list of playlists in case a new one was created
  };

  const handleDeleteVideoFromLibrary = async (videoToDelete) => {
    if (window.confirm(t.confirm_delete_from_library_and_playlist)) {
      try {
        // Delete the video from the library
        await Video.delete(videoToDelete.id);
        toast({
          title: t.video_deleted_from_library,
          description: `"${videoToDelete.title}" ${t.has_been_deleted}`,
        });

        // Remove the video ID from the current playlist as well
        if (playlist && playlist.videoIds.includes(videoToDelete.id)) {
          const updatedVideoIds = playlist.videoIds.filter(id => id !== videoToDelete.id);
          await Playlist.update(playlist.id, { videoIds: updatedVideoIds });
        }

        loadPlaylist(); // Refresh the current playlist view
      } catch (error) {
        console.error("Error deleting video from library:", error);
        toast({
          title: t.error_deleting_video,
          description: t.error_deleting_video_desc,
          variant: "destructive",
        });
      }
    }
  };

  const playAllFromPlaylist = () => {
    if (!videos || videos.length === 0) {
      toast({
        title: t.no_videos,
        description: t.no_videos_in_playlist,
        variant: "warning"
      });
      return;
    }

    const firstVideoToPlay = isRandomPlay
      ? videos[Math.floor(Math.random() * videos.length)]
      : videos[0];

    let playUrl = `${createPageUrl("Watch")}?id=${firstVideoToPlay.id}&playlistId=${playlist.id}`;

    // Add random parameter if shuffle play
    if (isRandomPlay) {
      playUrl += "&random=true";
    }

    navigate(playUrl);
  };

  // Add bulk management for videos in the playlist
  const handleBulkToggleFavorite = async (isFavorite) => { // Renamed and added parameter
    if (!videos || videos.length === 0) return;

    try {
      const promises = videos.map(video => Video.update(video.id, { favorite: isFavorite }));
      await Promise.all(promises);

      toast({
        title: isFavorite
          ? t.marked_all_as_favorites
          : t.unmarked_all_as_favorites,
        description: `${videos.length} ${t.videos_updated}`
      });

      loadPlaylist(); // Refresh the data
    } catch (error) {
      console.error("Error updating favorite status in bulk:", error);
      toast({
        title: t.error,
        description: t.error_updating_videos,
        variant: "destructive"
      });
    }
  };

  const handleBulkToggleWatchLater = async (markWatchLater) => {
    if (!videos || videos.length === 0) return;

    try {
      const newStatus = markWatchLater ? 'watch-later' : null;
      const promises = videos.map(video => Video.update(video.id, { watchStatus: newStatus }));
      await Promise.all(promises);

      toast({
        title: markWatchLater
          ? t.added_to_watch_later
          : t.removed_from_watch_later,
        description: `${videos.length} ${t.videos_updated}`
      });

      loadPlaylist(); // Refresh the data
    } catch (error) {
      console.error("Error updating watch later status:", error);
      toast({
        title: t.error,
        description: t.error_updating_videos,
        variant: "destructive"
      });
    }
  };

  const handleBulkToggleKidFriendly = async (makeFriendly) => {
    if (!videos || videos.length === 0) return;

    try {
      const promises = videos.map(video => Video.update(video.id, { kidFriendly: makeFriendly }));
      await Promise.all(promises);

      toast({
        title: makeFriendly
          ? t.added_to_kids_mode
          : t.removed_from_kids_mode,
        description: `${videos.length} ${t.videos_updated}`
      });

      loadPlaylist(); // Refresh the data
    } catch (error) {
      console.error("Error updating kid-friendly status:", error);
      toast({
        title: t.error,
        description: t.error_updating_videos,
        variant: "destructive"
      });
    }
  };


  if (loading) {
    return (
      <div className="container mx-auto p-4 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FunLoader />
          <h3 className="mt-4 text-lg font-medium">{t.loading_playlist}</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl("MyPlaylists"))}
          className="mb-6"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t.back_to_playlists}
        </Button>
        <div className="p-8 bg-red-50 rounded-lg text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-700">{error}</h3>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="container mx-auto p-4">
        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl("MyPlaylists"))}
          className="mb-6"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t.back_to_playlists}
        </Button>
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold">{t.playlist_not_found}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl("MyPlaylists"))}
          size="sm"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t.back_to_playlists}
        </Button>
      </div>

      {loading ? (
        <div className="container mx-auto p-4 min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <FunLoader />
            <h3 className="mt-4 text-lg font-medium">{t.loading_playlist}</h3>
          </div>
        </div>
      ) : !playlist ? (
        <div className="container mx-auto p-4">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("MyPlaylists"))}
            className="mb-6"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t.back_to_playlists}
          </Button>
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold">{t.playlist_not_found}</h3>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 p-6 rounded-xl shadow-lg text-white" style={(() => {
            const savedTheme = localStorage.getItem('video-vault-theme') || 'default';
            const themeGradients = {
              default: 'linear-gradient(135deg, #64748b, #475569)', // Gray gradient for default theme
              dark: 'linear-gradient(135deg, #1e40af, #2563eb)',
              blue: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
              green: 'linear-gradient(135deg, #10b981, #34d399)',
              purple: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
              warm: 'linear-gradient(135deg, #f97316, #ea580c)',
              cool: 'linear-gradient(135deg, #06b6d4, #0891b2)'
            };
            return { background: themeGradients[savedTheme] || themeGradients.default };
          })()}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">{playlist.name}</h1>
                {playlist.description && (
                  <p className="text-sm text-gray-200 mt-1">{playlist.description}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 items-center">
              {/* Share Button */}
              <Button
                variant="outline"
                className="flex items-center bg-white/20 hover:bg-white/30 text-white border-white/30"
                onClick={handleSharePlaylist}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {t.share}
              </Button>

              {/* Add Videos Button */}
              <Link to={createPageUrl("Add") + `?selectMode=true&playlistId=${playlist.id}`}>
                <Button className="flex items-center bg-white/20 hover:bg-white/30 text-white border-white/30">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.add_videos}
                </Button>
              </Link>

              {/* Enhanced Manage Videos Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <ListFilter className="h-4 w-4 mr-2" />
                    {t.manage_videos}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsSelectMode(true)}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    {t.select_videos}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkToggleFavorite(true)}>
                    <Star className="h-4 w-4 mr-2 text-yellow-500" />
                    {t.mark_all_as_favorite}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkToggleFavorite(false)}>
                    <Star className="h-4 w-4 mr-2 text-gray-400" />
                    {t.unmark_all_as_favorite}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkToggleWatchLater(true)}>
                    <Bookmark className="h-4 w-4 mr-2 text-blue-500" />
                    {t.add_all_to_watch_later}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkToggleWatchLater(false)}>
                    <Bookmark className="h-4 w-4 mr-2 text-gray-400" />
                    {t.remove_all_from_watch_later}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkToggleKidFriendly(true)}>
                    <Users className="h-4 w-4 mr-2 text-green-500" />
                    {t.add_all_to_kids_mode}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkToggleKidFriendly(false)}>
                    <UserX className="h-4 w-4 mr-2 text-gray-400" />
                    {t.remove_all_from_kids_mode}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {isSelectMode && selectedVideos.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6 flex items-center justify-between">
              <span>{selectedVideos.length} {t.videos} {t.selected}</span>
              <Button
                variant="destructive"
                onClick={handleRemoveSelected}
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t.remove_selected}
              </Button>
            </div>
          )}

          {videos.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <ListVideo className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t.no_videos_in_playlist}</h3>
              <p className="text-gray-500 mb-4">{t.add_videos_to_start}</p>
              <Link to={createPageUrl("Add") + `?selectMode=true&playlistId=${playlist.id}`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {t.add_videos}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map(video => (
                <VideoCard
                  key={video.id}
                  video={video}
                  hideActions={isSelectMode} // Actions hidden when in select mode
                  selectable={isSelectMode}
                  isSelected={selectedVideos.some(v => v.id === video.id)}
                  onSelectToggle={handleSelectVideo}
                  playlistIdContext={playlist.id}
                  // Pass handlers for actions when not in select mode
                  onEditVideo={!isSelectMode ? handleEditVideo : undefined}
                  onToggleFavorite={!isSelectMode ? handleToggleFavorite : undefined}
                  onToggleWatchLater={!isSelectMode ? handleToggleWatchLater : undefined}
                  onToggleKidFriendly={!isSelectMode ? handleToggleKidFriendly : undefined}
                  onAddToPlaylist={!isSelectMode ? handleOpenAddToPlaylistDialog : undefined}
                  onDeleteVideo={!isSelectMode ? handleDeleteVideoFromLibrary : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editingVideo && (
        <VideoForm
          isOpen={isEditFormOpen}
          onClose={() => setIsEditFormOpen(false)}
          videoToEdit={editingVideo}
          onVideoSaved={handleVideoSaved}
          allCategories={allCategoriesForEdit}
        />
      )}

      {videoToAddToPlaylist && (
        <AddToPlaylistDialog
          isOpen={isAddToPlaylistOpen}
          onClose={() => setIsAddToPlaylistOpen(false)}
          video={videoToAddToPlaylist}
          playlists={allPlaylists}
          onVideoAddedToPlaylist={handleVideoAddedToPlaylist}
          onCreateNewPlaylist={loadAllPlaylists} // Reload all playlists if new one created
        />
      )}

      <SharePlaylistDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        playlistName={playlist?.name || ''}
        shareUrl={shareUrl}
      />
    </div>
  );
}
