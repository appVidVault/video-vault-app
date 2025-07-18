
import React, { useState, useEffect } from "react";
import { Video } from "@/entities/Video";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  ListVideo,
  Settings,
  Star,
  Users,
  Share2,
  RefreshCw,
  Plus 
} from "lucide-react";
import VideoCard from "../components/VideoCard";
import { useToast } from "@/components/ui/use-toast";
import VideoForm from "../components/VideoForm";
import LanguageSelector from "../components/LanguageSelector";
import { useTranslation } from "../components/LanguageProvider";
import AddToPlaylistDialog from "../components/AddToPlaylistDialog";
import { Playlist } from "@/entities/Playlist";
import PlaylistCard from "../components/PlaylistCard";
import FunLoader from '../components/FunLoader';
import PlaylistSkeletonCard from '../components/PlaylistSkeletonCard';
import { VideoIdCache } from "@/components/VideoIdCache";
import { fetchWithRetry, entityHelper } from "@/components/ApiUtils";
import { NetworkErrorBoundary } from "@/components/NetworkErrorHandler";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const batchLoadPlaylists = async (playlists, batchSize = 3) => {
  const processedPlaylists = [];

  for (let i = 0; i < playlists.length; i += batchSize) {
    const batch = playlists.slice(i, i + batchSize);

    const batchResults = await Promise.all(batch.map(async (playlist) => {
      if (!playlist.videoIds || playlist.videoIds.length === 0) {
        return playlist; // No video IDs to process
      }

      // Filter out IDs known to be invalid from cache first
      const filteredVideoIds = playlist.videoIds.filter(id => !VideoIdCache.isInvalidId(id));

      if (filteredVideoIds.length === 0) {
        // If all IDs were cached as invalid, or originally empty after filtering
        return {
          ...playlist,
          videoIds: [] // Ensure videoIds is an empty array
        };
      }

      let needsUpdate = filteredVideoIds.length !== playlist.videoIds.length; // Check if cache filtering removed anything
      const finalValidIds = [...filteredVideoIds]; // Start with cache-filtered IDs

      // For playlists with videos, check a small sample (e.g., up to 2) to confirm they are still valid
      // This helps catch videos that were deleted but not yet reflected in the cache
      const samplesToCheck = Math.min(2, filteredVideoIds.length); // Check at most 2 random videos from the filtered list

      if (samplesToCheck > 0) {
        // Shuffle to pick random samples
        const shuffled = [...filteredVideoIds].sort(() => 0.5 - Math.random());
        const selectedIds = shuffled.slice(0, samplesToCheck);

        for (const videoId of selectedIds) {
          try {
            const video = await entityHelper.get(Video, videoId); // Use entityHelper to get retry logic
            if (!video) { // If video not found by API (e.g., returns null/undefined from entityHelper)
              const index = finalValidIds.indexOf(videoId);
              if (index > -1) {
                finalValidIds.splice(index, 1); // Remove from our list of valid IDs
              }
              VideoIdCache.markAsInvalid(videoId); // Add to cache
              needsUpdate = true;
            }
          } catch (error) {
            // For permanent errors like "not found", mark as invalid.
            if (error.message?.includes('Object not found') ||
                error.message?.includes('ObjectNotFoundError') ||
                error.message?.includes('not found')) {
              const index = finalValidIds.indexOf(videoId);
              if (index > -1) {
                finalValidIds.splice(index, 1);
              }
              VideoIdCache.markAsInvalid(videoId); // Mark as invalid only for "not found" errors
              needsUpdate = true;
            }
            // For temporary errors (which entityHelper should have already handled retries for),
            // if it still fails, we consider it unavailable for this session.
            // Do NOT mark as permanently invalid in cache unless it's a "not found" error.
            else {
              const index = finalValidIds.indexOf(videoId);
              if (index > -1) {
                finalValidIds.splice(index, 1); // Remove from our list of valid IDs for this session
              }
              needsUpdate = true;
              console.warn(`Temporarily skipping video ${videoId} due to error after retries:`, error.message);
            }
          }
        }
      }

      // If any IDs were removed (either by cache or by live check), update the playlist entity
      if (needsUpdate) {
        try {
          // IMPORTANT FIX: Only update the videoIds field. Do not spread the old `playlist`
          // object, as that could overwrite newer changes with stale data, causing the bug.
          // Use entityHelper for retry logic
          await entityHelper.update(Playlist, playlist.id, {
            videoIds: finalValidIds // Update with the cleaned list of video IDs
          });
        } catch (error) {
          console.error("Error updating playlist with cleaned videoIds:", error);
          // Proceed with the locally cleaned list anyway for UI consistency
        }
      }

      return {
        ...playlist,
        videoIds: finalValidIds // Return playlist with (potentially) cleaned videoIds
      };
    }));

    processedPlaylists.push(...batchResults);

    // Add a delay between batches to further reduce load
    if (i + batchSize < playlists.length) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
    }
  }

  return processedPlaylists;
};

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [unassignedVideos, setUnassignedVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [errorVideos, setErrorVideos] = useState(null);
  const [errorPlaylists, setErrorPlaylists] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const { toast } = useToast();
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [videoToAddToPlaylist, setVideoToAddToPlaylist] = useState(null);

  const [targetPlaylistId, setTargetPlaylistId] = useState(null);
  const [targetPlaylistName, setTargetPlaylistName] = useState("");
  const [processingAddToPlaylist, setProcessingAddToPlaylist] = useState(false);

  const [showManager, setShowManager] = useState(false);
  const [manageMode, setManageMode] = useState(''); // 'delete', 'favorite', 'kids', 'playlist'

  // Add new state to track if filtering is complete
  const [filteringComplete, setFilteringComplete] = useState(false);

  useEffect(() => {
    if (document.body.classList.contains('kids-mode-active')) {
        document.body.classList.remove('kids-mode-active');
    }

    const urlParams = new URLSearchParams(window.location.search);
    const selectMode = urlParams.get('selectMode') === 'true';
    const playlistId = urlParams.get('playlistId');

    if (selectMode) {
      setIsSelectMode(true);
      if (playlistId) {
        loadPlaylistName(playlistId);
        setTargetPlaylistId(playlistId);
      }
    }

    loadVideos();
    loadPlaylists();
  }, []);

  const loadPlaylistName = async (playlistId) => {
    try {
      const playlist = await entityHelper.get(Playlist, playlistId);
      if (playlist) {
        setTargetPlaylistName(playlist.name);
      }
    } catch (error) {
      console.error("Error loading playlist:", error);
    }
  };

  const loadVideos = async () => {
    setLoadingVideos(true);
    setErrorVideos(null);
    setFilteringComplete(false); // Reset filtering status when loading videos
    try {
      const allVideos = await fetchWithRetry(() => Video.list());
      const validVideos = allVideos.filter(video => video && video.id);
      setVideos(validVideos);
    } catch (error) {
      console.error("Error loading videos:", error);
      setErrorVideos(t.error_loading_videos || "Error loading videos");
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const loadPlaylists = async () => {
    setLoadingPlaylists(true);
    setErrorPlaylists(null);
    setFilteringComplete(false); // Reset filtering status when loading playlists
    try {
      let userPlaylists = await fetchWithRetry(() => Playlist.list());

      // Use the refined batchLoadPlaylists for cleanup and validation
      const cleanedPlaylists = await batchLoadPlaylists(userPlaylists);
      setPlaylists(cleanedPlaylists);

      // The useEffect hook will handle filtering unassigned videos when playlists state updates.
      // Removing the direct call here to ensure state consistency.

    } catch (error) {
      console.error('Error loading or processing playlists:', error);
      setErrorPlaylists('Failed to load playlists');
    } finally {
      setLoadingPlaylists(false);
    }
  };

  // New function to filter videos that are not in any playlist
  const filterUnassignedVideos = (allVideos, allPlaylists) => {
    if (!allVideos || !allPlaylists) return;

    // Create a set of all video IDs that are in playlists
    const videoIdsInPlaylists = new Set();

    allPlaylists.forEach(playlist => {
      if (playlist.videoIds && Array.isArray(playlist.videoIds)) {
        playlist.videoIds.forEach(videoId => {
          videoIdsInPlaylists.add(videoId);
        });
      }
    });

    // Filter videos that are not in any playlist
    const filteredVideos = allVideos.filter(video => !videoIdsInPlaylists.has(video.id));
    setUnassignedVideos(filteredVideos);
    setFilteringComplete(true); // Mark filtering as complete
  };

  // Update this effect to filter unassigned videos when videos or playlists change
  useEffect(() => {
    // Only filter if both videos and playlists are loaded
    if (!loadingVideos && !loadingPlaylists && videos.length >= 0 && playlists.length >= 0) {
      filterUnassignedVideos(videos, playlists);
    }
  }, [videos, playlists, loadingVideos, loadingPlaylists]);

  const handleEditVideo = (video) => {
    setEditingVideo(video);
    setIsEditFormOpen(true);
  };

  const handleVideoSaved = () => {
    setIsEditFormOpen(false);
    setEditingVideo(null);
    loadVideos();
  };

  const handleToggleFavorite = async (video) => {
    try {
      // Use entityHelper for retry logic
      await entityHelper.update(Video, video.id, { favorite: !video.favorite });
      loadVideos(); // Refresh the video list
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

  const handleDeleteVideo = async (video) => {
    if (window.confirm(t.confirm_delete || "Are you sure you want to delete this video?")) {
      try {
        // Use entityHelper for retry logic
        await entityHelper.delete(Video, video.id);
        loadVideos(); // Refresh the video list
        toast({
          title: t.video_deleted || "Video deleted",
          description: `"${video.title}" ${t.has_been_deleted || "has been deleted"}`,
        });
      } catch (error) {
        console.error("Error deleting video:", error);
        toast({
          title: t.error || "Error",
          description: t.error_deleting_video || "Could not delete video",
          variant: "destructive"
        });
      }
    }
  };

  const handleToggleWatchLater = async (video) => {
    try {
      const newStatus = video.watchStatus === 'watch-later' ? 'in-progress' : 'watch-later';
      // Use entityHelper for retry logic
      await entityHelper.update(Video, video.id, { watchStatus: newStatus });

      setVideos(prevVideos =>
        prevVideos.map(v => v.id === video.id ? { ...v, watchStatus: newStatus } : v)
      );

      toast({
        title: newStatus === 'watch-later'
          ? t.added_to_watch_later || "Added to Watch Later"
          : t.removed_from_watch_later || "Removed from Watch Later",
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
      // Use entityHelper for retry logic
      await entityHelper.update(Video, video.id, { kidFriendly: !video.kidFriendly });
      loadVideos(); // Refresh the video list
      toast({
        title: video.kidFriendly ? t.remove_from_kids_mode : t.add_to_kids_mode,
        description: `"${video.title}" ${t.status_updated || 'status has been updated.'}`,
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

  const handleDeleteSelected = async () => {
    if (selectedVideos.length === 0) {
      toast({
        title: t.no_videos_selected || "No videos selected",
        description: t.please_select_videos_to_delete || "Please select videos to delete.",
        variant: "warning"
      });
      return;
    }

    try {
      // Use entityHelper for retry logic
      const promises = selectedVideos.map(video => entityHelper.delete(Video, video.id));
      await Promise.all(promises);

      toast({
        title: t.videos_deleted,
        description: `${selectedVideos.length} ${t.videos_removed_message}`
      });

      setSelectedVideos([]);
      setIsSelectMode(false); // Exit select mode after deletion
      loadVideos();
    } catch (error) {
      console.error("Error deleting videos:", error);
      toast({
        title: t.error,
        description: t.error_deleting_videos,
        variant: "destructive"
      });
    }
  };

  const handleAddToPlaylist = (video) => {
    setVideoToAddToPlaylist(video);
    setIsAddToPlaylistOpen(true);
  };

  const handleVideoAddedToPlaylist = (updatedPlaylist) => {
    setIsAddToPlaylistOpen(false);
    setVideoToAddToPlaylist(null);

    // Directly update the local playlists state. This is more reliable than a full refetch.
    setPlaylists(prevPlaylists =>
      prevPlaylists.map(p =>
        p.id === updatedPlaylist.id ? updatedPlaylist : p
      )
    );

    toast({
        title: t.video_added_to_playlist || "Video Added to Playlist",
        description: t.unassigned_list_updated || "The list of unassigned videos has been updated.",
    });
  };

  const toggleSelectMode = (enable) => {
    if (enable === false) {
      setIsSelectMode(false);
      setSelectedVideos([]);
    } else {
      setIsSelectMode(true);
    }
  };

  const handleAddSelectedToPlaylist = async () => {
    if (!targetPlaylistId || selectedVideos.length === 0) {
      toast({
        title: t.error || "Error",
        description: t.no_videos_selected || "No videos selected to add.",
        variant: "destructive"
      });
      return;
    }

    setProcessingAddToPlaylist(true);
    try {
      // Use entityHelper for retry logic
      const targetPlaylist = await entityHelper.get(Playlist, targetPlaylistId);
      if (!targetPlaylist) throw new Error("Playlist not found");

      const existingIds = targetPlaylist.videoIds || [];

      const selectedIds = selectedVideos.map(video => video.id);

      const newIds = selectedIds.filter(id => !existingIds.includes(id));

      if (newIds.length === 0) {
        toast({
          title: t.no_new_videos || "No New Videos",
          description: t.all_videos_already_in_playlist || "All selected videos are already in this playlist."
        });
        setProcessingAddToPlaylist(false);
        return;
      }

      // Use entityHelper for retry logic
      const updatedPlaylist = await entityHelper.update(Playlist, targetPlaylistId, {
        videoIds: [...existingIds, ...newIds]
      });

      toast({
        title: t.videos_added || "Videos Added",
        description: `${newIds.length} ${t.videos_added_to_playlist || "videos added to playlist."}`
      });

      // Update local playlists state directly after bulk add
      setPlaylists(prevPlaylists =>
        prevPlaylists.map(p =>
          p.id === updatedPlaylist.id ? updatedPlaylist : p
        )
      );

      setSelectedVideos([]);
      setIsSelectMode(false);
      setTargetPlaylistId(null);
      setTargetPlaylistName("");

      navigate(createPageUrl("Home"));

    } catch (error) {
      console.error("Error adding videos to playlist:", error);
      toast({
        title: t.error || "Error",
        description: t.error_adding_to_playlist || "Error adding videos to playlist.",
        variant: "destructive"
      });
    } finally {
      setProcessingAddToPlaylist(false);
    }
  };

  const handleBulkAction = async () => {
    if (selectedVideos.length === 0) {
      toast({
        title: t.no_videos_selected || "No videos selected",
        description: t.please_select_videos || "Please select videos first.",
        variant: "warning"
      });
      return;
    }

    try {
      switch(manageMode) {
        case 'delete':
          // Use entityHelper for retry logic
          const promises = selectedVideos.map(video => entityHelper.delete(Video, video.id));
          await Promise.all(promises);

          toast({
            title: t.videos_deleted,
            description: `${selectedVideos.length} ${t.videos_removed_message}`
          });
          break;

        case 'favorite':
          // Use entityHelper for retry logic
          const favoritePromises = selectedVideos.map(video =>
            entityHelper.update(Video, video.id, { favorite: true })
          );
          await Promise.all(favoritePromises);

          toast({
            title: t.added_to_favorites || "Added to Favorites",
            description: `${selectedVideos.length} ${t.videos_marked_as_favorites || "videos marked as favorites."}`
          });
          break;

        case 'unfavorite':
          // Use entityHelper for retry logic
          const unfavoritePromises = selectedVideos.map(video =>
            entityHelper.update(Video, video.id, { favorite: false })
          );
          await Promise.all(unfavoritePromises);

          toast({
            title: t.removed_from_favorites || "Removed from Favorites",
            description: `${selectedVideos.length} ${t.videos_removed_from_favorites || "videos removed from favorites."}`
          });
          break;

        case 'kids':
          // Use entityHelper for retry logic
          const kidsPromises = selectedVideos.map(video =>
            entityHelper.update(Video, video.id, { kidFriendly: true })
          );
          await Promise.all(kidsPromises);

          toast({
            title: t.added_to_kids_mode || "Added to Kids Mode",
            description: `${selectedVideos.length} ${t.videos_added_to_kids_mode || "videos added to kids mode."}`
          });
          break;

        case 'unkids':
          // Use entityHelper for retry logic
          const unkidsPromises = selectedVideos.map(video =>
            entityHelper.update(Video, video.id, { kidFriendly: false })
          );
          await Promise.all(unkidsPromises);

          toast({
            title: t.removed_from_kids_mode || "Removed from Kids Mode",
            description: `${selectedVideos.length} ${t.videos_removed_from_kids_mode || "videos removed from kids mode."}`
          });
          break;

        case 'playlist':
          // This just shows the playlist selection modal
          // The actual adding happens in handleAddSelectedToPlaylist
          setIsAddToPlaylistOpen(true);
          break;
      }
      setSelectedVideos([]);
      setIsSelectMode(false);
      setShowManager(false);
      loadVideos();
    } catch (error) {
      console.error(`Error performing bulk action (${manageMode}):`, error);
      toast({
        title: t.error || "Error",
        description: t.error_performing_action || "Error performing action on videos.",
        variant: "destructive"
      });
    }
  };

  const startManageMode = (mode) => {
    setManageMode(mode);
    setIsSelectMode(true);
    setShowManager(true);
  };


  return (
    <NetworkErrorBoundary onRetry={() => {
      loadVideos();
      loadPlaylists();
    }}>
      <div className="container mx-auto p-4 space-y-8">
        <div className="flex justify-between items-center">
          {/* Remove the LanguageSelector from here */}
          <div className="flex items-center gap-2">
            {/* LanguageSelector removed */}
          </div>

          {!isSelectMode ? (
            <div className="flex gap-2">

              <div className="flex flex-col gap-2">
                {/* Manage Videos Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-black border-black hover:bg-gray-100/50 w-full"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      {t.manage_videos || "Manage Videos"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => startManageMode('delete')}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t.delete_videos || "Delete Videos"}
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => startManageMode('favorite')}>
                      <Star className="mr-2 h-4 w-4 text-yellow-500" />
                      {t.add_to_favorites || "Add to Favorites"}
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => startManageMode('unfavorite')}>
                      <Star className="mr-2 h-4 w-4 text-gray-400" />
                      {t.remove_from_favorites || "Remove from Favorites"}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => startManageMode('kids')}>
                      <Users className="mr-2 h-4 w-4 text-green-500" />
                      {t.add_to_kids_mode || "Add to Kids Mode"}
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => startManageMode('unkids')}>
                      <Users className="mr-2 h-4 w-4 text-gray-400" />
                      {t.remove_from_kids_mode || "Remove from Kids Mode"}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => startManageMode('playlist')}>
                      <ListVideo className="mr-2 h-4 w-4" />
                      {t.add_to_playlist || "Add to Playlist"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Add Video and Upload Videos Buttons - Now side by side */}
                <div className="flex gap-2">
                  <Link to={createPageUrl("Add")}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-black border-black hover:bg-gray-100/50"
                    >
                      {t.add_youtube_videos || "Add YouTube Videos"}
                    </Button>
                  </Link>
                  <Link to={createPageUrl("UploadVideos")}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-black border-black hover:bg-gray-100/50"
                    >
                      {t.upload_personal_videos || "Upload Personal Videos"}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {t('videos_selected', { count: selectedVideos.length, defaultValue: '{{count}} videos selected' })}
              </span>
            </div>
          )}
        </div>

        {isSelectMode && targetPlaylistId && (
          <div className="mb-6 bg-blue-50 p-4 rounded-lg flex items-center justify-between sticky top-0 z-30 shadow">
            <div className="flex flex-col">
              <span className="font-medium">{t.adding_to_playlist || "Adding to playlist:"} {targetPlaylistName}</span>
              <span className="text-sm text-blue-600">
                {t('videos_selected', { count: selectedVideos.length, defaultValue: '{{count}} videos selected' })}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddSelectedToPlaylist}
                disabled={selectedVideos.length === 0 || processingAddToPlaylist}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processingAddToPlaylist ? (
                  <>Loading...</>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {t.add_to_playlist || "Add to Playlist"}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedVideos([]);
                  setTargetPlaylistId(null);
                  setTargetPlaylistName("");
                  navigate(createPageUrl("Home"));
                }}
              >
                <X className="h-4 w-4 mr-2" />
                {t.cancel || "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {showManager && !targetPlaylistId && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg flex items-center justify-between sticky top-0 z-30 shadow">
            <div className="flex flex-col">
              <span className="font-medium">
                {manageMode === 'delete' ? (t.deleting_videos || "Deleting Videos") :
                 manageMode === 'favorite' ? (t.adding_to_favorites || "Adding to Favorites") :
                 manageMode === 'unfavorite' ? (t.removing_from_favorites || "Removing from Favorites") :
                 manageMode === 'kids' ? (t.adding_to_kids_mode || "Adding to Kids Mode") :
                 manageMode === 'unkids' ? (t.removing_from_kids_mode || "Removing from Kids Mode") :
                 manageMode === 'playlist' ? (t.adding_to_playlist_action_title || t.add_to_playlist || "Adding to Playlist") :
                 ""}
              </span>
              <span className="text-sm text-blue-600">{selectedVideos.length} {t.videos_selected || "videos selected"}</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleBulkAction}
                disabled={selectedVideos.length === 0}
                className={`
                  ${manageMode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                `}
              >
                {manageMode === 'delete' && <Trash2 className="h-4 w-4 mr-2" />}
                {manageMode === 'favorite' && <Star className="h-4 w-4 mr-2" />}
                {manageMode === 'unfavorite' && <Star className="h-4 w-4 mr-2" />}
                {manageMode === 'kids' && <Users className="h-4 w-4 mr-2" />}
                {manageMode === 'unkids' && <Users className="h-4 w-4 mr-2" />}
                {manageMode === 'playlist' && <ListVideo className="h-4 w-4 mr-2" />}

                {
                  manageMode === 'delete' ? (t.delete_selected || "Delete Selected") :
                  manageMode === 'favorite' ? (t.add_to_favorites || "Add to Favorites") :
                  manageMode === 'unfavorite' ? (t.remove_from_favorites || "Remove from Favorites") :
                  manageMode === 'kids' ? (t.add_to_kids_mode || "Add to Kids Mode") :
                  manageMode === 'unkids' ? (t.remove_from_kids_mode || "Remove from Kids Mode") :
                  manageMode === 'playlist' ? (t.add_to_playlist_button || t.add_to_playlist || "Add to Playlist") :
                  ""
                }
              </Button>
              <Button variant="outline" onClick={() => {
                setIsSelectMode(false);
                setSelectedVideos([]);
                setShowManager(false);
                setManageMode('');
              }}>
                <X className="h-4 w-4 mr-2" />
                {t.cancel || "Cancel"}
              </Button>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-3">{t.my_playlists || "My Playlists"}</h2>
          {loadingPlaylists ? (
            <div>
              <div className="text-center mb-6 py-4">
                <FunLoader />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <PlaylistSkeletonCard key={i} />)}
              </div>
            </div>
          ) : errorPlaylists ? (
            <div className="text-center py-12 bg-red-50 p-6 rounded-lg border border-red-200">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-red-700 mb-2">{t.error_loading_playlists || "Error Loading Playlists"}</h3>
              <p className="text-red-600 mb-4">{errorPlaylists}</p>
              <Button onClick={loadPlaylists} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                {t.retry_loading_playlists || "Try Again"}
              </Button>
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p className="mb-2">{t.no_playlists_found || "No playlists yet."}</p>
              <Link to={createPageUrl("MyPlaylists")}>
                <Button variant="outline">{t.create_first_playlist || "Create Your First Playlist"}</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playlists.map(playlist => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">{t.unassigned_videos || "Unassigned Videos"}</h2>
          {loadingVideos || loadingPlaylists || !filteringComplete ? (
            <div className="text-center py-10">
              <FunLoader />
            </div>
          ) : errorVideos ? (
            <div className="text-center py-12 bg-red-50 p-6 rounded-lg border border-red-200">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-red-700 mb-2">{t.error_loading_videos || "Error Loading Videos"}</h3>
              <p className="text-red-600 mb-4">{errorVideos}</p>
              <Button onClick={loadVideos} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                {t.retry_loading_videos || "Try Again"}
              </Button>
            </div>
          ) : unassignedVideos.length === 0 && !isSelectMode ? (
            <div className="text-center py-10 text-gray-500">
              <p className="mb-2">{t.no_unassigned_videos || "No unassigned videos found. All videos are in playlists."}</p>
              <Link to={createPageUrl("Add")}>
                <Button>{t.add_new_video || "Add a New Video"}</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(isSelectMode ? videos : unassignedVideos).map(video => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onEditVideo={handleEditVideo}
                  onToggleFavorite={handleToggleFavorite}
                  onDeleteVideo={handleDeleteVideo}
                  onToggleKidFriendly={handleToggleKidFriendly}
                  onAddToPlaylist={handleAddToPlaylist}
                  onToggleWatchLater={handleToggleWatchLater}
                  selectable={isSelectMode}
                  isSelected={selectedVideos.some(v => v.id === video.id)}
                  onSelectToggle={handleSelectVideo}
                />
              ))}
            </div>
          )}
        </div>

        {editingVideo && (
          <VideoForm
            isOpen={isEditFormOpen}
            onClose={() => setIsEditFormOpen(false)}
            videoToEdit={editingVideo}
            onVideoSaved={handleVideoSaved}
          />
        )}

        {videoToAddToPlaylist && playlists && (
          <AddToPlaylistDialog
            isOpen={isAddToPlaylistOpen}
            onClose={() => setIsAddToPlaylistOpen(false)}
            video={videoToAddToPlaylist}
            playlists={playlists}
            onVideoAddedToPlaylist={handleVideoAddedToPlaylist}
            onCreateNewPlaylist={loadPlaylists}
          />
        )}

        {/* Playlist Selection Dialog for bulk add to playlist */}
        {manageMode === 'playlist' && selectedVideos.length > 0 && (
          <AddToPlaylistDialog
            isOpen={isAddToPlaylistOpen}
            onClose={() => {
              setIsAddToPlaylistOpen(false);
              setIsSelectMode(false);
              setSelectedVideos([]);
              setShowManager(false);
              setManageMode('');
            }}
            videos={selectedVideos}
            playlists={playlists}
            onVideosAddedToPlaylist={(updatedPlaylist) => { // This callback now receives updatedPlaylist
              setIsAddToPlaylistOpen(false);
              setIsSelectMode(false);
              setSelectedVideos([]);
              setShowManager(false);
              setManageMode('');

              // Directly update the local playlists state after bulk add
              setPlaylists(prevPlaylists =>
                prevPlaylists.map(p =>
                  p.id === updatedPlaylist.id ? updatedPlaylist : p
                )
              );
              loadVideos(); // Still good to reload videos in case some were filtered out as "unassigned" previously

              toast({
                title: t.videos_added_to_playlist || "Videos Added to Playlist",
                description: `${selectedVideos.length} ${t.videos_were_added || "videos were added to the playlist."}`
              });
            }}
            onCreateNewPlaylist={loadPlaylists}
            bulkMode={true}
          />
        )}
      </div>
    </NetworkErrorBoundary>
  );
}
