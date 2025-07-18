import React, { useState, useEffect } from "react";
import { Playlist } from "@/entities/Playlist";
import { Video } from "@/entities/Video";
// User entity might not be needed directly here unless filtering by created_by
// import { User } from "@/entities/User"; 
import { useTranslation } from "../components/LanguageProvider";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Dialog } from "@/components/ui/dialog";
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
import { Plus, FolderOpen, Trash, Pencil, ArrowLeft } from "lucide-react";
import { HelpButton } from "../components/ContextualHelp"; // Add this import

export default function UserPlaylists() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ name: "", description: "" });
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [videosById, setVideosById] = useState({});
  
  useEffect(() => {
    loadPlaylists();
  }, []);
  
  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const userPlaylists = await Playlist.list();
      console.log("Loaded playlists:", userPlaylists);
      setPlaylists(userPlaylists);
      
      const videos = await Video.list();
      const videoMap = {};
      videos.forEach(video => {
        videoMap[video.id] = video;
      });
      setVideosById(videoMap);
      
    } catch (error) {
      console.error("Error loading playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylist.name.trim()) return;
    
    try {
      const createdPlaylist = await Playlist.create({
        name: newPlaylist.name.trim(),
        description: newPlaylist.description.trim(),
        videoIds: [],
        createdDate: new Date().toISOString()
      });
      
      console.log("Created playlist:", createdPlaylist);
      setIsCreateDialogOpen(false);
      setNewPlaylist({ name: "", description: "" });
      await loadPlaylists();
    } catch (error) {
      console.error("Error creating playlist:", error);
    }
  };

  const handleEditPlaylist = async () => {
    if (!currentPlaylist || !currentPlaylist.name.trim()) return;
    
    try {
      await Playlist.update(currentPlaylist.id, {
        name: currentPlaylist.name.trim(),
        description: currentPlaylist.description.trim()
      });
      
      setIsEditDialogOpen(false);
      setCurrentPlaylist(null);
      await loadPlaylists();
    } catch (error) {
      console.error("Error updating playlist:", error);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!currentPlaylist) return;
    
    try {
      await Playlist.delete(currentPlaylist.id);
      setIsDeleteDialogOpen(false);
      setCurrentPlaylist(null);
      await loadPlaylists();
    } catch (error) {
      console.error("Error deleting playlist:", error);
    }
  };
  
  const getPlaylistCoverImage = (playlist) => {
    if (playlist.coverImage) return playlist.coverImage;
    
    if (playlist.videoIds && playlist.videoIds.length > 0) {
      for (const videoId of playlist.videoIds) {
        const video = videosById[videoId];
        if (video && (video.thumbnailUrl || video.thumbnail)) {
          return video.thumbnailUrl || video.thumbnail || 
                 `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
        }
      }
    }
    
    return "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&auto=format&fit=crop&q=80";
  };
  
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return "Unknown date";
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(createPageUrl("Home"))}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {t.my_video_playlists || "My Video Playlists"}
            </h1>
            <p className="text-gray-500 mt-1">
              {t.organize_your_videos_into_collections || "Organize your videos into personal collections."}
            </p>
          </div>
        </div>
        
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="md:self-end"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.create_new_playlist || "Create New Playlist"}
        </Button>
      </div>
      
      <HelpButton section="playlists" />

      {playlists.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <FolderOpen className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-xl font-medium mb-2">
            {t.no_playlists_yet || "No playlists yet"}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {t.no_playlists_yet_description || "Create your first playlist to organize your videos."}
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            {t.create_your_first_playlist || "Create Your First Playlist"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map(playlist => (
            <Card key={playlist.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={getPlaylistCoverImage(playlist)}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                  <h3 className="text-white font-bold text-lg line-clamp-1">
                    {playlist.name}
                  </h3>
                </div>
              </div>
              <CardContent className="pt-4 pb-2">
                {playlist.description && (
                  <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                    {playlist.description}
                  </p>
                )}
                <div className="flex justify-between items-center">
                  <div className="flex flex-col text-sm">
                    <span className="text-gray-500">
                      {playlist.videoIds ? playlist.videoIds.length : 0} {t.videos || "videos"}
                    </span>
                    {playlist.createdDate && (
                      <span className="text-gray-400 text-xs">
                        {t.created_on || "Created on"} {formatDate(playlist.createdDate)}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 pb-4 flex justify-between">
                <Button 
                  variant="secondary" 
                  onClick={() => navigate(`${createPageUrl("ViewPlaylist")}?id=${playlist.id}`)}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t.view || "View"}
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setCurrentPlaylist({...playlist});
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setCurrentPlaylist(playlist);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* Create Playlist Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.create_new_playlist || "Create New Playlist"}</DialogTitle>
            <DialogDescription>
              {t.give_your_playlist_a_name_and_description || "Give your playlist a name and an optional description."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.playlist_name || "Playlist Name"}
              </label>
              <Input
                placeholder={t.playlist_name_placeholder || "e.g., Workout Mix, Cooking Tutorials"}
                value={newPlaylist.name}
                onChange={(e) => setNewPlaylist({...newPlaylist, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t.description_optional || "Description (Optional)"}
              </label>
              <Textarea
                placeholder={t.playlist_description_placeholder || "A short summary of this playlist"}
                value={newPlaylist.description}
                onChange={(e) => setNewPlaylist({...newPlaylist, description: e.target.value})}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setNewPlaylist({ name: "", description: "" });
            }}>
              {t.cancel || "Cancel"}
            </Button>
            <Button onClick={handleCreatePlaylist} disabled={!newPlaylist.name.trim()}>
              {t.create_playlist || "Create Playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Playlist Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.edit_playlist || "Edit Playlist"}</DialogTitle>
            <DialogDescription>
              {t.update_playlist_details || "Update the name and description of your playlist."}
            </DialogDescription>
          </DialogHeader>
          {currentPlaylist && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t.playlist_name || "Playlist Name"}
                </label>
                <Input
                  placeholder={t.playlist_name_placeholder || "e.g., Workout Mix, Cooking Tutorials"}
                  value={currentPlaylist.name}
                  onChange={(e) => setCurrentPlaylist({...currentPlaylist, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t.description_optional || "Description (Optional)"}
                </label>
                <Textarea
                  placeholder={t.playlist_description_placeholder || "A short summary of this playlist"}
                  value={currentPlaylist.description || ""}
                  onChange={(e) => setCurrentPlaylist({...currentPlaylist, description: e.target.value})}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setCurrentPlaylist(null);
            }}>
              {t.cancel || "Cancel"}
            </Button>
            <Button onClick={handleEditPlaylist} disabled={!currentPlaylist || !currentPlaylist.name.trim()}>
              {t.save_changes || "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Playlist Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.delete_playlist_confirmation_title || "Delete Playlist"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.delete_playlist_confirmation_message || "Are you sure you want to delete the playlist"} "{currentPlaylist?.name}"?
              <br />
              {t.delete_action_cannot_be_undone || "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlaylist}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t.delete || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
