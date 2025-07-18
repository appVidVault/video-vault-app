import React, { useState, useEffect } from "react";
import { Album } from "@/entities/Album";
import { Photo } from "@/entities/Photo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  ArrowLeft, 
  Play, 
  Settings,
  Plus,
  Music,
  Image as ImageIcon,
  Grid,
  List,
  Baby 
} from "lucide-react";
import PhotoCard from "../components/photos/PhotoCard";
import FunLoader from "../components/FunLoader";
import EditPhotoDialog from "../components/photos/EditPhotoDialog";
import PhotoViewerModal from "../components/photos/PhotoViewerModal";
import SlideshowSettingsDialog from "../components/photos/SlideshowSettingsDialog";
import { useTranslation } from "../components/LanguageProvider";

export default function ViewAlbum() {
  const urlParams = new URLSearchParams(window.location.search);
  const albumId = urlParams.get('id');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [showSlideshowSettings, setShowSlideshowSettings] = useState(false);
  const [isKidsMode, setIsKidsMode] = useState(false);

  useEffect(() => {
    const kidsMode = urlParams.get('kids') === 'true';
    setIsKidsMode(kidsMode);

    if (kidsMode) {
      document.body.classList.add('kids-mode-active');
    }

    if (albumId) {
      loadAlbum();
    }

    return () => {
      document.body.classList.remove('kids-mode-active');
    };
  }, [albumId, window.location.search]); // Changed location.search to window.location.search to explicitly reference global object

  const handlePhotoUpdated = () => {
    setEditingPhoto(null);
    loadAlbum();
  };

  const loadAlbum = async () => {
    try {
      // Load album and photos in parallel for faster loading
      const [albumData, allPhotos] = await Promise.all([
        Album.get(albumId),
        Photo.list() // Load all photos at once instead of individual requests
      ]);

      if (!albumData) {
        toast({
          title: t.toast_album_not_found || "Album not found",
          variant: "destructive"
        });
        navigate(createPageUrl("PhotoGallery"));
        return;
      }

      setAlbum(albumData);

      // Filter photos that belong to this album from the complete list
      if (albumData.photoIds && albumData.photoIds.length > 0) {
        const albumPhotos = allPhotos.filter(photo => 
          albumData.photoIds.includes(photo.id)
        );
        setPhotos(albumPhotos);
      } else {
        setPhotos([]);
      }
    } catch (error) {
      console.error("Error loading album:", error);
      toast({
        title: t.toast_error_loading_album || "Error loading album",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (photo) => {
    try {
      await Photo.update(photo.id, { favorite: !photo.favorite });
      setPhotos(prev => 
        prev.map(p => p.id === photo.id ? { ...p, favorite: !p.favorite } : p)
      );
      toast({
        title: photo.favorite ? (t.toast_removed_from_favorites || "Removed from favorites") : (t.toast_added_to_favorites || "Added to favorites")
      });
    } catch (error) {
      console.error("Error updating favorite status:", error);
      toast({
        title: t.error || "Error",
        description: t.toast_error_update_favorite || "Could not update favorite status",
        variant: "destructive"
      });
    }
  };

  const handleDeletePhoto = async (photo) => {
    if (window.confirm(`Remove "${photo.title}" from this album?`)) { // This confirmation dialog is not translatable via `t` directly.
      try {
        // Remove photo from album
        const updatedPhotoIds = album.photoIds.filter(id => id !== photo.id);
        await Album.update(album.id, { 
          ...album,
          photoIds: updatedPhotoIds 
        });
        
        setPhotos(prev => prev.filter(p => p.id !== photo.id));
        setAlbum(prev => ({ ...prev, photoIds: updatedPhotoIds }));
        
        toast({
          title: t.toast_photo_removed || "Photo removed from album"
        });
      } catch (error) {
        console.error("Error removing photo from album:", error);
        toast({
          title: t.error || "Error",
          description: t.toast_error_remove_photo || "Could not remove photo from album",
          variant: "destructive"
        });
      }
    }
  };

  const handleSlideshowSettings = async (newSettings) => {
    try {
      const updatedAlbum = await Album.update(album.id, {
        ...album,
        slideshowSettings: newSettings
      });
      setAlbum(updatedAlbum);
      setShowSlideshowSettings(false);
      toast({
        title: t.toast_slideshow_settings_saved || "Slideshow settings saved",
        description: t.your_slideshow_preferences_have_been_updated || "Your slideshow preferences have been updated."
      });
    } catch (error) {
      console.error("Error updating slideshow settings:", error);
      toast({
        title: t.error || "Error",
        description: t.toast_error_save_slideshow_settings || "Could not save slideshow settings",
        variant: "destructive"
      });
    }
  };

  const handleToggleKidsMode = async () => {
    try {
      const updatedAlbum = await Album.update(album.id, {
        isKidFriendly: !album.isKidFriendly
      });
      setAlbum(updatedAlbum);
      toast({
        title: updatedAlbum.isKidFriendly ? (t.toast_added_to_kids || "Added to Kids Mode") : (t.toast_removed_from_kids || "Removed from Kids Mode"),
        description: updatedAlbum.isKidFriendly 
          ? (t.toast_album_now_available || '"{albumName}" is now available in Kids Mode').replace('{albumName}', album.name)
          : (t.toast_album_no_longer_available || '"{albumName}" is no longer available in Kids Mode').replace('{albumName}', album.name)
      });
    } catch (error) {
      console.error("Error updating kids mode status:", error);
      toast({
        title: t.error || "Error",
        description: t.toast_error_update_kids_status || "Could not update kids mode status",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FunLoader />
          <h3 className="mt-4 text-lg font-medium">{t.loading_album || "Loading album..."}</h3>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold">{t.album_not_found || "Album not found"}</h3>
          <Link to={createPageUrl(isKidsMode ? "Kids" : "PhotoGallery")}>
            <Button className="mt-4">{isKidsMode ? t('back_to_kids_zone', 'Back to Kids Zone') : t('back_to_gallery', 'Back to Gallery')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`container mx-auto p-4 space-y-6 ${isKidsMode ? 'pt-16' : ''}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 mb-6 ${isKidsMode ? 'fixed top-4 left-4 z-50' : ''}`}>
        <Link to={createPageUrl(isKidsMode ? "Kids" : "PhotoGallery")}>
          <Button variant="ghost" size="icon" className={`rounded-full ${isKidsMode ? 'bg-white/80 hover:bg-white/90' : ''}`}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{album.name}</h2>
          {album.description && (
            <p className="text-gray-600 mt-1">{album.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            {photos.length === 1 
              ? (t.photo_count_one || '1 photo') 
              : (t.photo_count_other || '{{count}} photos').replace('{{count}}', photos.length)}
            {album.musicFileUrl && (
              <span className="ml-2 inline-flex items-center">
                <Music className="h-4 w-4 mr-1" />
                {t.music_included || "Music included"}
              </span>
            )}
            {album.isKidFriendly && (
              <span className="ml-2 inline-flex items-center text-green-600">
                <Baby className="h-4 w-4 mr-1" />
                {t.kids_safe || "Kids Safe"}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Slideshow Controls */}
      {photos.length > 0 && (
         <div className="flex flex-wrap gap-3 mb-6">
          <Link to={createPageUrl(`Slideshow?albumId=${album.id}${isKidsMode ? '&kids=true' : ''}`)}>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
              <Play className="h-4 w-4 mr-2" />
              {t.start_slideshow || "Start Slideshow"}
            </Button>
          </Link>
          
          {!isKidsMode && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowSlideshowSettings(true)}
                className="border-purple-200 hover:bg-purple-50"
              >
                <Settings className="h-4 w-4 mr-2" />
                {t.slideshow_settings || "Slideshow Settings"}
              </Button>

              <Button
                variant={album.isKidFriendly ? "default" : "outline"}
                onClick={handleToggleKidsMode}
                className={album.isKidFriendly 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "border-green-200 hover:bg-green-50 text-green-700"
                }
              >
                <Baby className="h-4 w-4 mr-2" />
                {album.isKidFriendly ? (t.remove_from_kids_mode || "Remove from Kids Mode") : (t.add_to_kids_mode || "Add to Kids Mode")}
              </Button>

              <Link to={createPageUrl("PhotoGallery") + `?selectMode=true&albumId=${album.id}`}>
                <Button variant="outline" className="border-purple-200 hover:bg-purple-50">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.add_photos || "Add Photos"}
                </Button>
              </Link>
            </>
          )}
        </div>
      )}

      {/* Photos */}
      {photos.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t.no_photos_in_album || "No photos in this album"}</h3>
          <p className="text-gray-500 mb-4">{t.add_photos_prompt || "Add some photos to get started"}</p>
          {!isKidsMode && (
            <Link to={createPageUrl("PhotoGallery") + `?selectMode=true&albumId=${album.id}`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t.add_photos || "Add Photos"}
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className={`grid gap-4 ${
          viewMode === "grid" 
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            : "grid-cols-1"
        }`}>
          {photos.map(photo => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              viewMode={viewMode}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDeletePhoto}
              onEdit={() => setEditingPhoto(photo)}
              onView={() => setViewingPhoto(photo)}
              isKidsMode={isKidsMode} // Pass kids mode to PhotoCard if it needs to adjust its UI
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {viewingPhoto && (
        <PhotoViewerModal
          isOpen={!!viewingPhoto}
          photo={viewingPhoto}
          onClose={() => setViewingPhoto(null)}
          onEdit={() => {
            setEditingPhoto(viewingPhoto);
            setViewingPhoto(null);
          }}
          isKidsMode={isKidsMode} // Pass kids mode to PhotoViewerModal
        />
      )}
      {editingPhoto && (
        <EditPhotoDialog
          isOpen={!!editingPhoto}
          photo={editingPhoto}
          onClose={() => setEditingPhoto(null)}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}
      {/* Slideshow Settings Dialog */}
      <SlideshowSettingsDialog
        isOpen={showSlideshowSettings}
        onClose={() => setShowSlideshowSettings(false)}
        album={album}
        onSave={handleSlideshowSettings}
      />
    </div>
  );
}
