
import React, { useState, useEffect } from "react";
import { Playlist } from "@/entities/Playlist";
import { Video } from "@/entities/Video";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter, 
    DialogDescription, 
    DialogClose 
} from "@/components/ui/dialog";
import { Plus, ArrowLeft, ListVideo, Users, BadgeCheck, UserX, Share, Pencil, Trash2, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import SharePlaylistDialog from "../components/SharePlaylistDialog";
import VideoCard from "../components/VideoCard";
import { useTranslation } from "../components/LanguageProvider";

export default function MyPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [isPlaylistFormOpen, setIsPlaylistFormOpen] = useState(false);
  const [playlistFormMode, setPlaylistFormMode] = useState("create"); // "create" or "edit"
  const [currentPlaylistData, setCurrentPlaylistData] = useState({
    name: "", 
    description: "",
    isKidFriendly: false 
  });
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);

  const { toast } = useToast();
  const [isCreateModeActive, setIsCreateModeActive] = useState(false);
  const [selectedVideosForNewPlaylist, setSelectedVideosForNewPlaylist] = useState([]);
  const [allVideos, setAllVideos] = useState([]);
  const [activeTab, setActiveTab] = useState("playlists");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [playlistToShare, setPlaylistToShare] = useState(null);
  const [currentShareUrl, setCurrentShareUrl] = useState("");

  const navigate = useNavigate();

  // State for delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    const checkAdmin = async () => {
        try {
            const user = await User.me();
            if (user && user.role === 'admin') {
                setIsAdmin(true);
            }
        } catch(e) { /* not logged in or error */ }
    }
    checkAdmin();
    loadPlaylists();
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const videos = await Video.list();
      setAllVideos(videos);
    } catch (error) {
      console.error("Error loading videos:", error);
      toast({
        title: t.error || "Error",
        description: t.could_not_load_videos || "Could not load videos",
        variant: "destructive",
      });
    }
  };

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const userPlaylists = await Playlist.list();
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error("Error loading playlists:", error);
      toast({
        title: t.error || "Error",
        description: t.could_not_load_playlists || "Could not load playlists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 12);
  };

  const handleOpenShareDialog = async (playlist) => {
    let shareCode = playlist.shareCode;
    const videoIds = Array.isArray(playlist.videoIds) ? playlist.videoIds : [];

    if (!shareCode || !playlist.isShared) {
      shareCode = generateShareCode();
      try {
        await Playlist.update(playlist.id, { 
          name: playlist.name,
          description: playlist.description,
          videoIds: videoIds,
          coverImage: playlist.coverImage,
          isKidFriendly: playlist.isKidFriendly,
          shareCode: shareCode, 
          isShared: true 
        });
        const updatedPlaylists = playlists.map(p => 
          p.id === playlist.id ? { ...p, shareCode, isShared: true } : p
        );
        setPlaylists(updatedPlaylists);
      } catch (error) {
        console.error("Error updating playlist for sharing:", error);
        toast({
          title: t.error || "Error",
          description: t.could_not_enable_sharing || "Could not enable sharing for this playlist.",
          variant: "destructive",
        });
        return;
      }
    }
    
    const shareUrlToSet = `${window.location.origin}${createPageUrl("ViewSharedPlaylist")}?code=${shareCode}`;
    const playlistForDialog = playlists.find(p => p.id === playlist.id) || playlist; // Ensure we use latest from state if updated
    setPlaylistToShare(playlistForDialog);
    setCurrentShareUrl(shareUrlToSet);
    setIsShareDialogOpen(true);
  };

  const handleOpenCreateForm = () => {
    setPlaylistFormMode("create");
    setCurrentPlaylistData({ name: "", description: "", isKidFriendly: false });
    setSelectedVideosForNewPlaylist([]);
    setIsCreateModeActive(true);
    setActiveTab("selectVideos");
    setIsPlaylistFormOpen(false); 
  };

  const handleOpenEditForm = (playlist) => {
    setPlaylistFormMode("edit");
    setEditingPlaylistId(playlist.id);
    setCurrentPlaylistData({
      name: playlist.name,
      description: playlist.description || "",
      isKidFriendly: playlist.isKidFriendly || false,
    });
    setIsPlaylistFormOpen(true);
    setIsCreateModeActive(false); 
  };
  
  const handleSavePlaylist = async () => {
    if (!currentPlaylistData.name.trim()) {
      toast({
        title: t.error || "Error",
        description: t.please_enter_playlist_name || "Please enter a playlist name",
        variant: "destructive",
      });
      return;
    }

    try {
      if (playlistFormMode === "create") {
        await Playlist.create({
          name: currentPlaylistData.name.trim(),
          description: currentPlaylistData.description.trim(),
          isKidFriendly: currentPlaylistData.isKidFriendly,
          videoIds: selectedVideosForNewPlaylist.map(v => v.id),
          createdDate: new Date().toISOString()
        });
        toast({
          title: t.success || "Success",
          description: t.playlist_created_successfully || "Playlist created successfully"
        });
        setSelectedVideosForNewPlaylist([]);
        setIsCreateModeActive(false);
        setActiveTab("playlists");
      } else if (playlistFormMode === "edit" && editingPlaylistId) {
        const existingPlaylist = await Playlist.get(editingPlaylistId);
        if (!existingPlaylist) {
          toast({ title: t.error || "Error", description: t.playlist_not_found_for_update || "Playlist not found for update.", variant: "destructive" });
          return;
        }
        await Playlist.update(editingPlaylistId, {
          name: currentPlaylistData.name.trim(),
          description: currentPlaylistData.description.trim(),
          isKidFriendly: currentPlaylistData.isKidFriendly,
          videoIds: existingPlaylist.videoIds,
          coverImage: existingPlaylist.coverImage,
          shareCode: existingPlaylist.shareCode,
          isShared: existingPlaylist.isShared,
          createdDate: existingPlaylist.createdDate,
        });
        toast({
          title: t.success || "Success",
          description: t.playlist_updated_successfully || "Playlist updated successfully"
        });
      }

      setIsPlaylistFormOpen(false);
      setCurrentPlaylistData({ name: "", description: "", isKidFriendly: false });
      setEditingPlaylistId(null);
      loadPlaylists();
    } catch (error) {
      console.error(`Error ${playlistFormMode}ing playlist:`, error);
      toast({
        title: t.error || "Error",
        description: `${t.could_not || "Could not"} ${playlistFormMode} ${t.playlist || "playlist"}. ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleVideoSelectForNewPlaylist = (video) => {
    setSelectedVideosForNewPlaylist(prev => {
      const isSelected = prev.some(v => v.id === video.id);
      if (isSelected) {
        return prev.filter(v => v.id !== video.id);
      } else {
        return [...prev, video];
      }
    });
  };

  const togglePlaylistKidFriendly = async (playlist) => {
    try {
      const existingPlaylist = await Playlist.get(playlist.id);
      if (!existingPlaylist) throw new Error("Playlist not found");

      await Playlist.update(playlist.id, {
        ...existingPlaylist,
        isKidFriendly: !playlist.isKidFriendly
      });
      
      loadPlaylists();
      
      toast({
        title: !playlist.isKidFriendly 
          ? (t.added_to_kids_mode || "Added to Kids Mode") 
          : (t.removed_from_kids_mode || "Removed from Kids Mode"),
        description: !playlist.isKidFriendly 
          ? `"${playlist.name}" ${t.will_now_appear_in_kids_mode || "will now appear in Kids Mode"}` 
          : `"${playlist.name}" ${t.will_no_longer_appear_in_kids_mode || "will no longer appear in Kids Mode"}`
      });
    } catch (error) {
      console.error("Error updating playlist kid-friendly status:", error);
      toast({
        title: t.error || "Error",
        description: t.could_not_update_kid_friendly_status || "Could not update playlist kid-friendly status",
        variant: "destructive"
      });
    }
  };

  const proceedToCreatePlaylistDetails = () => {
    if (selectedVideosForNewPlaylist.length === 0 && playlistFormMode === "create") {
        toast({
            title: t.no_videos_selected || "No Videos Selected",
            description: t.please_select_at_least_one_video || "Please select at least one video for the new playlist, or create an empty playlist first and add videos later.",
            variant: "warning",
        });
    }
    setPlaylistFormMode("create");
    setCurrentPlaylistData({ name: "", description: "", isKidFriendly: false });
    setIsPlaylistFormOpen(true);
  };

  const handleOpenDeleteDialog = (playlist) => {
    setPlaylistToDelete(playlist);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!playlistToDelete) return;
    try {
      await Playlist.delete(playlistToDelete.id);
      toast({
        title: t.playlist_deleted || "Playlist Deleted",
        description: `"${playlistToDelete.name}" ${t.has_been_deleted || "has been deleted."}`,
      });
      setPlaylists(playlists.filter(p => p.id !== playlistToDelete.id));
      setIsDeleteDialogOpen(false);
      setPlaylistToDelete(null);
    } catch (error) {
      console.error("Error deleting playlist:", error);
      toast({
        title: t.error || "Error",
        description: t.could_not_delete_playlist || "Could not delete the playlist.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("Home")}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t.my_playlists || "My Playlists"}</h1>
          <p className="text-gray-500 mt-1">{t.organize_videos_into_collections || "Organize your videos into collections"}</p>
        </div>
        <div className="flex items-center gap-2">
            {isAdmin && (
                <Link to={createPageUrl("ManagePublicLibrary")}>
                    <Button variant="outline">
                        <Shield className="h-4 w-4 mr-2" />
                        {t.manage_library || "Manage Library"}
                    </Button>
                </Link>
            )}
            <Button 
              onClick={handleOpenCreateForm} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.new_playlist || "New Playlist"}
            </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="playlists">{t.my_playlists || "My Playlists"}</TabsTrigger>
          {isCreateModeActive && (
            <TabsTrigger value="selectVideos">{t.select_videos_for_new_playlist || "Select Videos for New Playlist"}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="playlists">
          {loading ? (
            <div className="text-center py-12">{t.loading_playlists || "Loading playlists..."}</div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <ListVideo className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t.no_playlists_yet || "No playlists yet"}</h3>
              <p className="text-gray-500 mb-4">{t.create_first_playlist_to_organize || "Create your first playlist to organize your videos"}</p>
              <Button 
                onClick={handleOpenCreateForm}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t.create_playlist || "Create Playlist"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {playlists.map(playlist => (
                <Card 
                  key={playlist.id} 
                  className={`hover:shadow-lg transition-shadow flex flex-col ${
                    playlist.isKidFriendly ? 'border-2 border-green-300' : ''
                  } ${ playlist.isShared ? 'border-2 border-blue-300' : '' }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="line-clamp-1 mr-2">{playlist.name}</CardTitle>
                      <div className="flex items-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-1"
                          title={playlist.isKidFriendly ? (t.remove_from_kids_mode || "Remove from Kids Mode") : (t.add_to_kids_mode || "Add to Kids Mode")}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePlaylistKidFriendly(playlist);
                          }}
                        >
                          {playlist.isKidFriendly ? (
                            <BadgeCheck className="h-5 w-5 text-green-500" />
                          ) : (
                            <UserX className="h-5 w-5 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-1"
                          title={playlist.isShared ? (t.sharing_options || "Sharing Options") : (t.share_playlist || "Share Playlist")}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOpenShareDialog(playlist);
                          }}
                        >
                          <Share className={`h-5 w-5 ${playlist.isShared ? 'text-blue-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                    </div>
                    {playlist.isKidFriendly && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200 mb-1">
                        <Users className="h-3 w-3 mr-1" />
                        {t.kids_mode || "Kids Mode"}
                      </Badge>
                    )}
                     {playlist.isShared && (
                      <Badge variant="outline" className="border-blue-500 text-blue-700 mb-1">
                        {t.shared || "Shared"}
                      </Badge>
                    )}
                    <CardDescription className="line-clamp-2 h-10">{playlist.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow pt-2">
                    <p className="text-sm text-gray-400 mt-2 mb-2">
                      {playlist.videoIds?.length || 0} {t.videos || "videos"}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-2 pb-4">
                    <div className="flex flex-wrap justify-start items-center gap-2">
                        <Link to={`${createPageUrl("ViewPlaylist")}?id=${playlist.id}`}>
                          <Button size="sm" variant="outline">
                            {t.view || "View"}
                          </Button>
                        </Link>
                        <Button 
                           size="sm" 
                           variant="outline" 
                           className="flex items-center"
                           onClick={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             handleOpenEditForm(playlist);
                           }}
                         >
                           <Pencil className="h-4 w-4 mr-1" /> {t.edit || "Edit"}
                         </Button>
                        <Link to={`${createPageUrl("Home")}?selectMode=true&playlistId=${playlist.id}`}>
                          <Button size="sm" variant="outline" className="flex items-center">
                            <Plus className="h-4 w-4 mr-1" />
                            {t.add_videos || "Add Videos"}
                          </Button>
                        </Link>
                         <Button 
                           size="sm" 
                           variant="outline" 
                           className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
                           onClick={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             handleOpenDeleteDialog(playlist);
                           }}
                         >
                           <Trash2 className="h-4 w-4 mr-1" /> {t.delete || "Delete"}
                         </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="selectVideos">
          {isCreateModeActive && (
            <>
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  {t.selected || "Selected"} {selectedVideosForNewPlaylist.length} {t.videos_for_new_playlist || "videos for the new playlist."}
                </p>
                <Button
                  onClick={proceedToCreatePlaylistDetails}
                  className="mt-2"
                >
                  {t.next_name_your_playlist || "Next: Name Your Playlist"}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {allVideos.map(video => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    selectable={true}
                    isSelected={selectedVideosForNewPlaylist.some(v => v.id === video.id)}
                    onSelectToggle={handleVideoSelectForNewPlaylist}
                  />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isPlaylistFormOpen} onOpenChange={(isOpen) => {
          setIsPlaylistFormOpen(isOpen);
          if (!isOpen) {
              setCurrentPlaylistData({ name: "", description: "", isKidFriendly: false });
              setEditingPlaylistId(null);
          }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {playlistFormMode === "create" 
                ? (t.name_your_new_playlist || "Name Your New Playlist")
                : (t.edit_playlist_details || "Edit Playlist Details")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.playlist_name || "Playlist Name"}</label>
              <Input
                value={currentPlaylistData.name}
                onChange={(e) => setCurrentPlaylistData({ ...currentPlaylistData, name: e.target.value })}
                placeholder={t.enter_playlist_name || "Enter playlist name"}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.description_optional || "Description (optional)"}</label>
              <Textarea
                value={currentPlaylistData.description}
                onChange={(e) => setCurrentPlaylistData({ ...currentPlaylistData, description: e.target.value })}
                placeholder={t.enter_playlist_description || "Enter playlist description"}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="kid-friendly"
                checked={currentPlaylistData.isKidFriendly}
                onCheckedChange={(checked) => setCurrentPlaylistData({ ...currentPlaylistData, isKidFriendly: checked })}
              />
              <label htmlFor="kid-friendly" className="flex items-center text-sm font-medium">
                <Users className="h-4 w-4 mr-1.5 text-green-500" />
                {t.approve_for_kids_mode || "Approve for Kids Mode"}
              </label>
            </div>
            {playlistFormMode === "create" && (
              <p className="text-sm text-gray-500">
                {selectedVideosForNewPlaylist.length} {t.videos_selected_for_new_playlist || "videos selected for this new playlist."}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsPlaylistFormOpen(false);
                if (playlistFormMode === "create" && isCreateModeActive) { 
                    setActiveTab("selectVideos");
                }
              }}
            >
              {t.cancel || "Cancel"}
            </Button>
            <Button 
              onClick={handleSavePlaylist}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {playlistFormMode === "create" ? (t.create_playlist || "Create Playlist") : (t.update_playlist || "Update Playlist")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SharePlaylistDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        playlistName={playlistToShare?.name || ""}
        shareUrl={currentShareUrl}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.delete_playlist || "Delete Playlist"}</DialogTitle>
            <DialogDescription>
              {t.confirm_delete_playlist || "Are you sure you want to delete the playlist"} "{playlistToDelete?.name}"? {t.action_cannot_be_undone || "This action cannot be undone."} {t.videos_not_deleted_from_library || "Videos within the playlist will not be deleted from your library."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t.cancel || "Cancel"}</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
            >
              {t.delete_playlist || "Delete Playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
