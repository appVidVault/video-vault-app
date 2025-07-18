
import React, { useState, useEffect } from "react";
import { Video } from "@/entities/Video";
import { Star, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import VideoCard from "./VideoCard";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "../components/LanguageProvider";
import AddToPlaylistDialog from "../components/AddToPlaylistDialog";
import { Playlist } from "@/entities/Playlist";
import VideoForm from "../components/VideoForm";

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();

  const [isAddToPlaylistDialogOpen, setIsAddToPlaylistDialogOpen] = useState(false);
  const [videoToAddToPlaylist, setVideoToAddToPlaylist] = useState(null);
  const [playlists, setPlaylists] = useState([]);

  const [isEditVideoDialogOpen, setIsEditVideoDialogOpen] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState(null);
  const [allCategoriesForEdit, setAllCategoriesForEdit] = useState([]);


  const loadFavorites = async () => {
    setLoading(true);
    try {
      const allVideos = await Video.list();
      const favoriteVideos = allVideos.filter(video => video.favorite);
      setFavorites(favoriteVideos.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)));

      const uniqueCategories = allVideos
        .map(v => v.category)
        .filter(Boolean)
        .reduce((acc, curr) => acc.includes(curr) ? acc : [...acc, curr], []);
      setAllCategoriesForEdit(uniqueCategories);

    } catch (error) {
      console.error("Error loading favorite videos:", error);
      toast({
        title: t.error_loading_favorites_title || "Error Loading Favorites",
        description: t.error_loading_favorites_desc || "Could not fetch your favorite videos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const loadPlaylists = async () => {
    try {
      const userPlaylists = await Playlist.list();
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error("Error loading playlists:", error);
    }
  };

  useEffect(() => {
    loadFavorites();
    loadPlaylists();
  }, []);

  const handleToggleFavorite = async (video) => {
    try {
      await Video.update(video.id, { favorite: !video.favorite });
      setFavorites(prevFavorites => prevFavorites.filter(v => v.id !== video.id));
      toast({
        title: t.removed_from_favorites || "Removed from Favorites",
        description: `"${video.title}" ${t.removed_from_favorites_desc || "has been removed from your favorites."}`,
      });
    } catch (error) {
      console.error("Error updating favorite status:", error);
      toast({
        title: t.error_updating_favorite_title || "Error Updating Favorite",
        variant: "destructive",
      });
    }
  };
  
  const handleToggleWatchLater = async (video) => {
    try {
      const newStatus = video.watchStatus === 'watch-later' ? 'in-progress' : 'watch-later';
      await Video.update(video.id, { watchStatus: newStatus });
      
      setFavorites(prevFavorites => 
        prevFavorites.map(fav => fav.id === video.id ? {...fav, watchStatus: newStatus} : fav)
      );

      toast({
        title: newStatus === 'watch-later'
          ? t.added_to_watch_later || "Added to Watch Later"
          : t.removed_from_watch_later || "Removed from Watch Later",
      });
    } catch (error) {
      console.error("Error updating watch later status:", error);
      toast({
        title: t.error_updating_status_title || "Error Updating Status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVideo = async (videoId) => {
    try {
      await Video.delete(videoId);
      setFavorites(favorites.filter(v => v.id !== videoId));
      toast({
        title: t.video_deleted_title || "Video Deleted",
      });
    } catch (error) {
      console.error("Error deleting video:", error);
      toast({
        title: t.error_deleting_video_title || "Error Deleting Video",
        variant: "destructive",
      });
    }
  };

  const handleToggleKidFriendly = async (video) => {
    try {
      await Video.update(video.id, { kidFriendly: !video.kidFriendly });
      setFavorites(prevFavorites => 
        prevFavorites.map(fav => fav.id === video.id ? {...fav, kidFriendly: !video.kidFriendly} : fav)
      );
      toast({
        title: video.kidFriendly ? (t.removed_from_kids_mode || "Removed from Kids Mode") : (t.added_to_kids_mode || "Added to Kids Mode"),
      });
    } catch (error) {
      toast({ title: t.error_updating_status_title || "Error Updating Status", variant: "destructive" });
    }
  };
  
  const handleOpenAddToPlaylistDialog = (video) => {
    setVideoToAddToPlaylist(video);
    setIsAddToPlaylistDialogOpen(true);
  };

  const handleVideoAddedToPlaylist = () => {
    setIsAddToPlaylistDialogOpen(false);
    setVideoToAddToPlaylist(null);
  };

  const handleOpenEditVideoDialog = (video) => {
    setVideoToEdit(video);
    setIsEditVideoDialogOpen(true);
  };

  const handleVideoEdited = () => {
    setIsEditVideoDialogOpen(false);
    setVideoToEdit(null);
    loadFavorites();
  };


  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex items-center gap-2 mb-8">
        <Link to={createPageUrl("Home")}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t.favorites_page_title || "Favorite Videos"}</h1>
        
        <div className="ml-auto">
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
          <div className="bg-yellow-50 rounded-full p-5 mb-6 inline-block">
            <Star className="h-12 w-12 text-yellow-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-700 mb-2">{t.no_favorite_videos_title || "No Favorite Videos Yet"}</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {t.no_favorite_videos_desc || "Add videos to your favorites by clicking the star icon on any video card. They'll show up here for quick access!"}
          </p>
          <Link to={createPageUrl("Home")}>
            <Button>{t.go_to_videos_button || "Go to Your Videos"}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
          {favorites.map(video => (
            <VideoCard 
              key={video.id} 
              video={video} 
              onToggleFavorite={handleToggleFavorite}
              onDeleteVideo={() => handleDeleteVideo(video.id)}
              onToggleKidFriendly={handleToggleKidFriendly}
              onAddToPlaylist={handleOpenAddToPlaylistDialog}
              onEditVideo={handleOpenEditVideoDialog}
              onToggleWatchLater={handleToggleWatchLater}
            />
          ))}
        </div>
      )}
      <AddToPlaylistDialog
        isOpen={isAddToPlaylistDialogOpen}
        onClose={() => setIsAddToPlaylistDialogOpen(false)}
        video={videoToAddToPlaylist}
        playlists={playlists}
        onVideoAddedToPlaylist={handleVideoAddedToPlaylist}
        onCreateNewPlaylist={loadPlaylists}
      />
       {videoToEdit && (
        <VideoForm
          isOpen={isEditVideoDialogOpen}
          onClose={() => setIsEditVideoDialogOpen(false)}
          videoToEdit={videoToEdit}
          onVideoSaved={handleVideoEdited}
          allCategories={allCategoriesForEdit}
        />
      )}
    </div>
  );
}
