import React, { useState, useEffect } from "react";
import { Playlist } from "@/entities/Playlist";
import { Video } from "@/entities/Video"; // To potentially get thumbnails later
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, ListMusic, Edit, Eye, Loader2, ArrowLeft } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "../components/LanguageProvider";

export default function VideoPlaylistsPage() {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState(null); // For editing
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const fetchedPlaylists = await Playlist.list();
      // Enrich playlists with cover images (simplified for now)
      const enrichedPlaylists = await Promise.all(
        fetchedPlaylists.map(async (p) => {
          let cover = p.coverImageUrl;
          if (!cover && p.videoIds && p.videoIds.length > 0) {
            try {
              // This is a simplification. In a real app, you'd fetch the specific video.
              // For now, we're not directly fetching video details here to keep it light.
              // We can improve this later if needed.
              // const firstVideo = await Video.get(p.videoIds[0]);
              // cover = firstVideo?.thumbnail || `https://img.youtube.com/vi/${firstVideo?.videoId}/mqdefault.jpg`;
            } catch (e) { console.warn("Could not fetch video for thumbnail", e)}
          }
          return { ...p, effectiveCoverImageUrl: cover };
        })
      );
      setPlaylists(enrichedPlaylists.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      console.error(t.error_loading_playlists || "Error loading playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setNewPlaylistName("");
    setNewPlaylistDescription("");
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setIsSaving(true);
    try {
      await Playlist.create({
        name: newPlaylistName,
        description: newPlaylistDescription,
        videoIds: [] // Initialize with empty videoIds
      });
      resetCreateForm();
      setIsCreateDialogOpen(false);
      loadPlaylists();
    } catch (error) {
      console.error(t.error_creating_playlist || "Error creating playlist:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleEditPlaylist = (playlist) => {
    setCurrentPlaylist(playlist);
    setNewPlaylistName(playlist.name);
    setNewPlaylistDescription(playlist.description || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdatePlaylist = async () => {
    if (!currentPlaylist || !newPlaylistName.trim()) return;
    setIsSaving(true);
    try {
      await Playlist.update(currentPlaylist.id, {
        name: newPlaylistName,
        description: newPlaylistDescription,
      });
      setCurrentPlaylist(null);
      resetCreateForm();
      setIsEditDialogOpen(false);
      loadPlaylists();
    } catch (error) {
      console.error(t.error_updating_playlist || "Error updating playlist:", error);
    } finally {
      setIsSaving(false);
    }
  };


  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    setIsSaving(true);
    try {
      await Playlist.delete(playlistToDelete.id);
      setPlaylists(playlists.filter(p => p.id !== playlistToDelete.id));
      setPlaylistToDelete(null);
    } catch (error) {
      console.error(t.error_deleting_playlist || "Error deleting playlist:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container py-6 md:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div className="flex items-center gap-2">
            <RouterLink to={createPageUrl("Home")}>
                <Button variant="outline" size="icon" className="h-9 w-9">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </RouterLink>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">{t.my_video_playlists || "My Video Playlists"}</h1>
                <p className="text-gray-500 mt-1">{t.organize_your_videos_into_collections || "Organize your videos into personal collections."}</p>
            </div>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => {
            setIsCreateDialogOpen(isOpen);
            if (!isOpen) resetCreateForm();
        }}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700">
              <PlusCircle className="mr-2 h-4 w-4" /> {t.create_new_playlist || "Create New Playlist"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.create_new_playlist || "Create New Playlist"}</DialogTitle>
              <DialogDescription>{t.give_your_playlist_a_name_and_description || "Give your playlist a name and an optional description."}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="playlist-name">{t.playlist_name || "Playlist Name"}</Label>
                <Input
                  id="playlist-name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder={t.playlist_name_placeholder || "e.g., Workout Mix, Cooking Tutorials"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="playlist-description">{t.description_optional || "Description (Optional)"}</Label>
                <Textarea
                  id="playlist-description"
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  placeholder={t.playlist_description_placeholder || "A short summary of this playlist"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>{t.cancel || "Cancel"}</Button>
              <Button onClick={handleCreatePlaylist} disabled={isSaving || !newPlaylistName.trim()}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.create_playlist || "Create Playlist"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full bg-gray-200" />
              <CardContent className="p-4">
                <Skeleton className="h-6 w-2/3 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
              <CardFooter className="p-4 flex justify-between items-center">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-blue-50 rounded-full p-6 mb-4">
            <ListMusic className="h-12 w-12 text-blue-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-700 mb-2">{t.no_playlists_yet || "No playlists yet"}</h3>
          <p className="text-gray-500 mb-6 max-w-md">
            {t.no_playlists_yet_description || "Create your first playlist to organize your videos."}
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            {t.create_your_first_playlist || "Create Your First Playlist"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map(playlist => (
            <Card key={playlist.id} className="overflow-hidden flex flex-col">
              <div className="aspect-video w-full bg-gray-100 relative">
                {playlist.effectiveCoverImageUrl ? (
                  <img 
                    src={playlist.effectiveCoverImageUrl} 
                    alt={playlist.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ListMusic className="h-12 w-12 text-gray-300" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {(playlist.videoIds?.length || 0)} {t.videos || "videos"}
                </div>
              </div>
              
              <CardHeader className="p-4">
                <CardTitle className="text-lg line-clamp-1">{playlist.name}</CardTitle>
                {playlist.description && (
                  <p className="text-gray-500 text-sm line-clamp-2 h-10 mt-1">{playlist.description}</p>
                )}
              </CardHeader>
              
              <CardContent className="p-4 pt-0 flex-grow">
                <p className="text-xs text-gray-400">
                  {t.created_on || "Created on"} {format(new Date(playlist.created_date), "MMM d, yyyy")}
                </p>
              </CardContent>
              
              <CardFooter className="p-4 border-t flex justify-between items-center">
                <RouterLink to={createPageUrl(`ViewPlaylist?id=${playlist.id}`)} className="flex-1 mr-2">
                  <Button variant="outline" className="w-full text-sm">
                    <Eye className="h-4 w-4 mr-2" />{t.view || "View"}
                  </Button>
                </RouterLink>
                <Button variant="ghost" size="icon" onClick={() => handleEditPlaylist(playlist)} className="text-gray-500 hover:text-blue-600">
                    <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPlaylistToDelete(playlist)} className="text-gray-500 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Playlist Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => {
          setIsEditDialogOpen(isOpen);
          if (!isOpen) { setCurrentPlaylist(null); resetCreateForm(); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.edit_playlist || "Edit Playlist"}</DialogTitle>
            <DialogDescription>{t.update_playlist_details || "Update the name and description of your playlist."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-playlist-name">{t.playlist_name || "Playlist Name"}</Label>
              <Input
                id="edit-playlist-name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-playlist-description">{t.description_optional || "Description (Optional)"}</Label>
              <Textarea
                id="edit-playlist-description"
                value={newPlaylistDescription}
                onChange={(e) => setNewPlaylistDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t.cancel || "Cancel"}</Button>
            <Button onClick={handleUpdatePlaylist} disabled={isSaving || !newPlaylistName.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.save_changes || "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!playlistToDelete} onOpenChange={(open) => !open && setPlaylistToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete_playlist_confirmation_title || "Delete Playlist"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.delete_playlist_confirmation_message || "Are you sure you want to delete the playlist"} "{playlistToDelete?.name}"? {t.delete_action_cannot_be_undone || "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{t.cancel || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlaylist}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.delete || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}