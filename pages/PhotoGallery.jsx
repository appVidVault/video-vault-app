
import React, { useState, useEffect } from "react";
import { Photo } from "@/entities/Photo";
import { Album } from "@/entities/Album";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Upload, 
  ImageIcon, 
  ArrowLeft,
  Grid,
  List,
  Search,
  FolderPlus,
  ImageOff
} from "lucide-react";
import PhotoCard from "../components/photos/PhotoCard";
import AlbumCard from "../components/photos/AlbumCard";
import UploadPhotosDialog from "../components/photos/UploadPhotosDialog";
import CreateAlbumDialog from "../components/photos/CreateAlbumDialog";
import FunLoader from "../components/FunLoader";
import { useTranslation } from "../components/LanguageProvider";
import EditPhotoDialog from "../components/photos/EditPhotoDialog";
import PhotoViewerModal from "../components/photos/PhotoViewerModal";
import AddToAlbumDialog from "../components/photos/AddToAlbumDialog";

export default function PhotoGallery() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [unassignedPhotos, setUnassignedPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteringComplete, setFilteringComplete] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCreateAlbumDialog, setShowCreateAlbumDialog] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [showAddToAlbumDialog, setShowAddToAlbumDialog] = useState(false);
  const [selectedPhotosForAlbum, setSelectedPhotosForAlbum] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      filterUnassignedPhotos(photos, albums);
    }
  }, [photos, albums, loading]);

  const loadData = async () => {
    setLoading(true);
    setFilteringComplete(false);
    try {
      const [photosData, albumsData] = await Promise.all([Photo.list(), Album.list()]);
      setPhotos(photosData || []);
      setAlbums(albumsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: t.error || "Error",
        description: t.could_not_load_photos_and_albums || "Could not load your photos and albums",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const filterUnassignedPhotos = (allPhotos, allAlbums) => {
    if (!allPhotos || !allAlbums) return;
    const photoIdsInAlbums = new Set();
    allAlbums.forEach(album => {
      album.photoIds?.forEach(id => photoIdsInAlbums.add(id));
    });
    const filtered = allPhotos.filter(photo => !photoIdsInAlbums.has(photo.id));
    setUnassignedPhotos(filtered);
    setFilteringComplete(true);
  };

  const handlePhotoUpdated = () => {
    setEditingPhoto(null);
    loadData();
  };

  const handleToggleFavorite = async (photo) => {
    try {
      await Photo.update(photo.id, { favorite: !photo.favorite });
      loadData(); // Refresh all data to ensure consistency
      toast({ title: photo.favorite ? (t.removed_from_favorites || "Removed from favorites") : (t.added_to_favorites || "Added to favorites") });
    } catch (error) {
      console.error("Error updating favorite status:", error);
      toast({ title: t.error || "Error", description: t.could_not_update_favorite_status || "Could not update favorite status", variant: "destructive" });
    }
  };

  const handleDeletePhoto = async (photo) => {
    if (window.confirm(t.confirm_delete_photo || `Are you sure you want to delete "${photo.title}"?`)) {
      try {
        await Photo.delete(photo.id);
        loadData(); // Refresh all data
        toast({ title: t.photo_deleted || "Photo deleted", description: t.photo_deleted_desc || `"${photo.title}" has been deleted` });
      } catch (error) {
        console.error("Error deleting photo:", error);
        toast({ title: t.error || "Error", description: t.could_not_delete_photo || "Could not delete photo", variant: "destructive" });
      }
    }
  };

  const handleToggleKidsMode = async (album) => {
    try {
      await Album.update(album.id, { isKidFriendly: !album.isKidFriendly });
      loadData(); // Refresh all data
      toast({ 
        title: album.isKidFriendly ? (t.removed_from_kids_mode || "Removed from Kids Mode") : (t.added_to_kids_mode || "Added to Kids Mode"),
        description: t.album_kids_mode_status || `"${album.name}" ${album.isKidFriendly ? (t.is_no_longer || 'is no longer') : (t.is_now || 'is now')} ${t.available_in_kids_mode || 'available in Kids Mode'}`
      });
    } catch (error) {
      console.error("Error updating kids mode status:", error);
      toast({ title: t.error || "Error", description: t.could_not_update_kids_mode_status || "Could not update kids mode status", variant: "destructive" });
    }
  };

  const handleAddPhotoToAlbum = (photo) => {
    setSelectedPhotosForAlbum([photo]);
    setShowAddToAlbumDialog(true);
  };

  const handlePhotosAddedToAlbum = () => {
    setShowAddToAlbumDialog(false);
    setSelectedPhotosForAlbum([]);
    loadData(); // Refresh data to update photo assignments
  };

  const filteredAlbums = albums.filter(album =>
    album.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    album.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUnassignedPhotos = unassignedPhotos.filter(photo =>
    photo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    photo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    photo.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const onDataChanged = () => {
    setShowCreateAlbumDialog(false);
    setShowUploadDialog(false);
    loadData();
  };

  if (loading && !filteringComplete) {
    return (
      <div className="container mx-auto p-4 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FunLoader />
          <h3 className="mt-4 text-lg font-medium">{t.loading || "Loading..."} {t.photo_gallery_title_lower || "photo gallery"}...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{t.photo_gallery_title || "Photo Gallery"}</h1>
          <p className="text-gray-500 mt-1">{t.photo_gallery_subtitle || "Organize your photos into beautiful albums"}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateAlbumDialog(true)} variant="outline" size="sm">
            <FolderPlus className="h-4 w-4 mr-2" /> {t.new_album || "New Album"}
          </Button>
          <Button onClick={() => setShowUploadDialog(true)} className="bg-blue-600 hover:bg-blue-700" size="sm">
            <Upload className="h-4 w-4 mr-2" /> {t.upload_photos || "Upload Photos"}
          </Button>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder={t.search_photos_and_albums || "Search photos and albums..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Albums Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t.my_albums || "My Albums"}</h2>
        {filteredAlbums.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <FolderPlus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? (t.no_albums_found || "No albums found") : (t.no_albums_yet || "No albums yet")}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? (t.try_adjusting_search || "Try adjusting your search terms") : (t.create_first_album || "Create your first album to organize your photos")}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateAlbumDialog(true)}>
                <FolderPlus className="h-4 w-4 mr-2" /> {t.create_album || "Create Album"}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredAlbums.map(album => (
              <AlbumCard 
                key={album.id} 
                album={album} 
                photos={photos}
                onToggleKidsMode={handleToggleKidsMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Unassigned Photos Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t.unassigned_photos || "Unassigned Photos"}</h2>
          <div className="flex gap-2">
            <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")}>
              <Grid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {loading && !filteringComplete ? (
           <FunLoader />
        ) : filteredUnassignedPhotos.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <ImageOff className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? (t.no_unassigned_photos_found || "No unassigned photos found") : (t.all_photos_in_albums || "All photos are in albums!")}
            </h3>
            <p className="text-gray-500">
              {searchTerm ? (t.try_adjusting_search_unassigned || "Try adjusting your search") : (t.upload_more_or_create_album || "Upload more photos or create a new album.")}
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 ${
            viewMode === "grid" 
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-1"
          }`}>
            {filteredUnassignedPhotos.map(photo => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                viewMode={viewMode}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDeletePhoto}
                onEdit={() => setEditingPhoto(photo)}
                onView={() => setViewingPhoto(photo)}
                onAddToAlbum={() => handleAddPhotoToAlbum(photo)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs and Modals */}
      <UploadPhotosDialog isOpen={showUploadDialog} onClose={() => setShowUploadDialog(false)} onPhotosUploaded={onDataChanged} />
      <CreateAlbumDialog isOpen={showCreateAlbumDialog} onClose={() => setShowCreateAlbumDialog(false)} onAlbumCreated={onDataChanged} photos={photos} />
      {viewingPhoto && <PhotoViewerModal isOpen={!!viewingPhoto} photo={viewingPhoto} onClose={() => setViewingPhoto(null)} onEdit={() => { setEditingPhoto(viewingPhoto); setViewingPhoto(null); }} />}
      {editingPhoto && <EditPhotoDialog isOpen={!!editingPhoto} photo={editingPhoto} onClose={() => setEditingPhoto(null)} onPhotoUpdated={handlePhotoUpdated} />}
      
      {/* Add to Album Dialog */}
      <AddToAlbumDialog
        isOpen={showAddToAlbumDialog}
        onClose={() => setShowAddToAlbumDialog(false)}
        photos={selectedPhotosForAlbum}
        albums={albums} 
        onPhotosAddedToAlbum={handlePhotosAddedToAlbum}
      />
    </div>
  );
}
