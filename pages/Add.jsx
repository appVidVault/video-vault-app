
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Video } from "@/entities/Video";
import { Playlist } from "@/entities/Playlist";
import { youtubeApi } from "@/functions/youtubeApi";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../components/LanguageProvider";
import FunLoader from "../components/FunLoader";
import {
  CheckCircle2,
  ChevronLeft,
  Film,
  Loader2,
  Plus,
  X,
  Circle,
  ListVideo,
  ChevronDown
} from "lucide-react";

export default function Add() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // YouTube search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [addingVideoId, setAddingVideoId] = useState(null);
  const [nextPageToken, setNextPageToken] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  
  // URL input state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [addingUrl, setAddingUrl] = useState(false);
  
  // MultiSelect Mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState(null);
  const [targetPlaylistName, setTargetPlaylistName] = useState("");
  const [processingMultiAdd, setProcessingMultiAdd] = useState(false);

  // Check URL parameters and localStorage on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectModeParam = urlParams.get('selectMode');
    const playlistIdParam = urlParams.get('playlistId');
    
    if (selectModeParam === 'true') {
      setSelectMode(true);
      
      if (playlistIdParam) {
        setTargetPlaylistId(playlistIdParam);
        loadPlaylistName(playlistIdParam);
      }
    }
  }, []);

  const loadPlaylistName = async (playlistId) => {
    try {
      const playlist = await Playlist.get(playlistId);
      if (playlist) {
        setTargetPlaylistName(playlist.name);
      }
    } catch (error) {
      console.error("Error loading playlist:", error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setNextPageToken("");
    setYoutubeResults([]);
    
    try {
      const { data } = await youtubeApi({ 
        searchTerm: searchQuery,
        maxResults: 12
      });
      
      if (data && data.items && Array.isArray(data.items)) {
        const formattedResults = data.items.map(item => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
        }));
        
        setYoutubeResults(formattedResults);
        
        if (data.nextPageToken) {
          setNextPageToken(data.nextPageToken);
        } else {
          setNextPageToken("");
        }
      } else {
        setYoutubeResults([]);
        toast({
          title: t.no_results || "No Results Found",
          description: t.try_different_search || "Try a different search term."
        });
      }
    } catch (error) {
      console.error("YouTube search error:", error);
      toast({
        title: t.search_error || "Search Error",
        description: t.error_searching_youtube || "There was an error searching YouTube.",
        variant: "destructive"
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!searchQuery.trim() || !nextPageToken || loadingMore) return;
    
    setLoadingMore(true);
    
    try {
      const { data } = await youtubeApi({ 
        searchTerm: searchQuery,
        maxResults: 12,
        pageToken: nextPageToken
      });
      
      if (data && data.items && Array.isArray(data.items)) {
        const formattedResults = data.items.map(item => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
        }));
        
        setYoutubeResults(prev => [...prev, ...formattedResults]);
        
        if (data.nextPageToken) {
          setNextPageToken(data.nextPageToken);
        } else {
          setNextPageToken("");
        }
      }
    } catch (error) {
      console.error("YouTube load more error:", error);
      toast({
        title: t.error || "Error",
        description: t.error_loading_more || "Error loading more results.",
        variant: "destructive"
      });
    } finally {
      setLoadingMore(false);
    }
  };
  
  const handleAddYoutubeVideo = async (videoData) => {
    setAddingVideoId(videoData.videoId);
    try {
      const existingVideos = await Video.filter({ videoId: videoData.videoId });
      let videoId;
      
      if (existingVideos && existingVideos.length > 0) {
        videoId = existingVideos[0].id;
        toast({
          title: t.video_already_in_library || "Video Already in Library",
          description: videoData.title
        });
      } else {
        const newVideo = await Video.create({
          title: videoData.title,
          sourceType: "youtube",
          videoId: videoData.videoId,
          channelTitle: videoData.channelTitle,
          description: videoData.description,
          thumbnail: videoData.thumbnail,
          dateAdded: new Date().toISOString()
        });
        videoId = newVideo.id;
        
        toast({
          title: t.video_added || "Video Added",
          description: videoData.title
        });
      }
      
      if (selectMode && targetPlaylistId) {
        await addVideoToPlaylist(videoId, targetPlaylistId);
      }
      
    } catch (error) {
      console.error("Error adding video:", error);
      toast({
        title: t.error || "Error",
        description: t.failed_to_add_video || "Failed to add video.",
        variant: "destructive"
      });
    } finally {
      setAddingVideoId(null);
    }
  };
  
  const addVideoToPlaylist = async (videoId, playlistId) => {
    try {
      const playlist = await Playlist.get(playlistId);
      if (!playlist) throw new Error("Playlist not found");
      
      const existingIds = playlist.videoIds || [];
      if (existingIds.includes(videoId)) {
        toast({
          title: t.already_in_playlist || "Already in Playlist",
          description: t.video_already_in_this_playlist || "This video is already in this playlist."
        });
        return;
      }
      
      await Playlist.update(playlistId, {
        ...playlist,
        videoIds: [...existingIds, videoId]
      });
      
      toast({
        title: t.added_to_playlist || "Added to Playlist",
        description: t.video_added_to_playlist || "Video added to playlist successfully."
      });
    } catch (error) {
      console.error("Error adding to playlist:", error);
      toast({
        title: t.error || "Error",
        description: t.failed_to_add_to_playlist || "Failed to add to playlist.",
        variant: "destructive"
      });
    }
  };
  
  const handleSelectVideo = (video) => {
    setSelectedVideos(prev => {
      const isSelected = prev.some(v => v.videoId === video.videoId);
      if (isSelected) {
        return prev.filter(v => v.videoId !== video.videoId);
      } else {
        return [...prev, video];
      }
    });
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

    setProcessingMultiAdd(true);
    try {
      const targetPlaylist = await Playlist.get(targetPlaylistId);
      if (!targetPlaylist) throw new Error("Playlist not found");

      const existingIds = targetPlaylist.videoIds || [];
      const currentVideoCount = existingIds.length;

      const PLAYLIST_LIMIT = 60;
      if (currentVideoCount >= PLAYLIST_LIMIT) {
          toast({
              title: t('playlist_full_title', 'Playlist Full'),
              description: t('playlist_full_create_new', 'This playlist has reached the 60 video limit. Please create a new one to add more videos.'),
              variant: "destructive"
          });
          setProcessingMultiAdd(false);
          return;
      }
      
      const newVideoIds = [];
      
      for (const videoData of selectedVideos) {
        try {
          let videoId;
          if (videoData.videoId) {
            const existingVideos = await Video.filter({ videoId: videoData.videoId });
            if (existingVideos && existingVideos.length > 0) {
              videoId = existingVideos[0].id;
            } else {
              const newVideo = await Video.create({
                title: videoData.title || "Untitled Video",
                sourceType: "youtube",
                videoId: videoData.videoId,
                channelTitle: videoData.channelTitle,
                thumbnail: videoData.thumbnail,
                dateAdded: new Date().toISOString()
              });
              videoId = newVideo.id;
            }
          }
          
          if (videoId && !existingIds.includes(videoId)) {
            newVideoIds.push(videoId);
          }
        } catch (err) {
          console.error("Error adding video:", err);
        }
      }
      
      if (currentVideoCount + newVideoIds.length > PLAYLIST_LIMIT) {
        const availableSlots = PLAYLIST_LIMIT - currentVideoCount;
        toast({
            title: t('playlist_limit_reached_title', "Playlist Limit Reached"),
            description: t('playlist_limit_add_fewer', `You can only add ${availableSlots} more video(s) to this playlist. Please select fewer videos.`, { count: availableSlots }),
            variant: "destructive"
        });
        setProcessingMultiAdd(false);
        return;
      }
      
      const combinedIds = [...existingIds, ...newVideoIds];
      const addedCount = newVideoIds.length;

      if (addedCount > 0) {
        await Playlist.update(targetPlaylistId, {
          ...targetPlaylist,
          videoIds: combinedIds
        });
        
        toast({
          title: t.videos_added || "Videos Added",
          description: `${addedCount} ${t.videos_added_to_playlist || "videos added to playlist."}`,
        });
      } else {
        toast({
          title: t.no_new_videos || "No New Videos",
          description: t.all_videos_already_in_playlist || "All selected videos are already in this playlist."
        });
      }
      
      setSelectedVideos([]);
      navigate(createPageUrl(`ViewPlaylist?id=${targetPlaylistId}`));
      
    } catch (error) {
      console.error("Error adding videos to playlist:", error);
      toast({
        title: t.error || "Error",
        description: t.error_adding_to_playlist || "Error adding videos to playlist.",
        variant: "destructive"
      });
    } finally {
      setProcessingMultiAdd(false);
    }
  };

  const handleFocusSearch = () => {
    document.getElementById('youtube-search').focus();
  };

  const handleUrlEnter = (e) => {
    if (e.key === 'Enter') {
      handleAddByUrl();
    }
  };

  const handleAddByUrl = async () => {
    if (!youtubeUrl) {
      toast({
        title: t.error || "Error",
        description: t.no_url_entered || "Please enter a YouTube URL.",
        variant: "destructive"
      });
      return;
    }

    setAddingUrl(true);
    try {
      const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (!videoIdMatch || !videoIdMatch[1]) {
        throw new Error("Invalid YouTube URL");
      }

      const videoId = videoIdMatch[1];
      
      const { data } = await youtubeApi({ videoId });
      if (!data || !data.items || data.items.length === 0) {
        throw new Error("Could not fetch video details");
      }

      const videoDetails = data.items[0];
      const videoData = {
        videoId,
        title: videoDetails.snippet.title,
        description: videoDetails.snippet.description,
        channelTitle: videoDetails.snippet.channelTitle,
        thumbnail: videoDetails.snippet.thumbnails.medium?.url || videoDetails.snippet.thumbnails.default?.url
      };

      const existingVideos = await Video.filter({ videoId });
      if (existingVideos && existingVideos.length > 0) {
        toast({
          title: t.video_already_exists || "Video Already Exists",
          description: videoData.title
        });
        setYoutubeUrl("");
        return;
      }

      await Video.create({
        title: videoData.title,
        sourceType: "youtube",
        videoId: videoData.videoId,
        channelTitle: videoData.channelTitle,
        description: videoData.description,
        thumbnail: videoData.thumbnail,
        dateAdded: new Date().toISOString()
      });

      toast({
        title: t.youtube_video_added || "YouTube Video Added",
        description: t.youtube_video_added_desc || "The video has been added to your collection."
      });

      setYoutubeUrl("");
      
    } catch (error) {
      console.error("Error adding video by URL:", error);
      toast({
        title: t.error || "Error",
        description: error.message === "Invalid YouTube URL" 
          ? (t.invalid_youtube_url || "Invalid YouTube URL. Please enter a valid YouTube video URL.")
          : (t.failed_to_save_video || "Failed to save video. Please try again."),
        variant: "destructive"
      });
    } finally {
      setAddingUrl(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="outline" 
          onClick={() => {
            if (targetPlaylistId) {
              navigate(createPageUrl(`ViewPlaylist?id=${targetPlaylistId}`));
            } else {
              navigate(createPageUrl("Home"));
            }
          }}
          size="sm"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {targetPlaylistId ? (t.back_to_playlist || 'Back to Playlist') : (t.back_to_homepage || 'Back to Homepage')}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {targetPlaylistId ? `${t.add_videos_to || 'Add Videos to'} "${targetPlaylistName}"` : t.add_videos || 'Add Videos'}
          </h1>
          {selectMode && (
            <p className="text-sm text-gray-500 mt-1">
              {t.select_multiple_videos_help || 'Select multiple videos to add to your playlist'}
            </p>
          )}
        </div>
      </div>

      {selectMode && selectedVideos.length > 0 && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg flex items-center justify-between">
          <span className="text-blue-700">
            {t.selected || 'Selected'} {selectedVideos.length} {t.videos || 'videos'}
          </span>
          <Button 
            onClick={handleAddSelectedToPlaylist}
            disabled={processingMultiAdd}
          >
            {processingMultiAdd ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.adding || 'Adding'}...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t.add_selected_videos || 'Add Selected Videos'}
              </>
            )}
          </Button>
        </div>
      )}

      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="search" onClick={handleFocusSearch}>
            {t.search_youtube || "Search YouTube"}
          </TabsTrigger>
          <TabsTrigger value="url">
            {t.add_by_url || "Add by URL"}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-5 h-5" />
                {t.search_youtube || "Search YouTube"}
              </CardTitle>
              <CardDescription>
                {t.search_description || "Search for videos and add them to your collection with one click."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  id="youtube-search"
                  type="text"
                  placeholder={t.search_placeholder || "Search YouTube and press Enter..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onFocus={handleFocusSearch}
                />
                <Button type="submit" disabled={searchLoading || !searchQuery.trim()}>
                  {searchLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    t.search || "Search"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          {searchLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <FunLoader />
              <p className="mt-4 text-sm text-gray-600">Searching YouTube...</p>
            </div>
          )}

          {youtubeResults.length > 0 && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  {t.search_results || "Search Results"}
                </h3>
                
                {!selectMode && (
                  <Link to={createPageUrl("MyPlaylists")}>
                    <Button variant="outline">
                      <ListVideo className="mr-2 h-4 w-4" />
                      {t.choose_playlist || "Choose Playlist"}
                    </Button>
                  </Link>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {youtubeResults.map((video) => (
                  selectMode ? (
                    <div 
                      key={video.videoId} 
                      className={`relative cursor-pointer rounded-lg overflow-hidden border hover:shadow-lg transition-all duration-200 ${
                        selectedVideos.some(v => v.videoId === video.videoId) ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'
                      }`}
                      onClick={() => handleSelectVideo(video)}
                    >
                      <div className="aspect-video bg-gray-100 relative">
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                        
                        <div className="absolute top-2 right-2 bg-white/80 rounded-full w-6 h-6 flex items-center justify-center">
                          {selectedVideos.some(v => v.videoId === video.videoId) ? (
                            <CheckCircle2 className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <h3 className="font-medium text-sm line-clamp-2">
                          {video.title || t.no_title || "No title"}
                        </h3>
                        {video.channelTitle && (
                          <p className="text-xs text-gray-500 mt-1">{video.channelTitle}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div 
                      key={video.videoId} 
                      className="rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="aspect-video bg-gray-100 relative">
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3">
                        <h3 className="font-medium text-sm line-clamp-2 mb-2">
                          {video.title || t.no_title || "No title"}
                        </h3>
                        {video.channelTitle && (
                          <p className="text-xs text-gray-500">{video.channelTitle}</p>
                        )}
                        
                        <Button
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleAddYoutubeVideo(video)}
                          disabled={addingVideoId === video.videoId}
                        >
                          {addingVideoId === video.videoId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          {t.add_to_library || "Add to Library"}
                        </Button>
                      </div>
                    </div>
                  )
                ))}
              </div>
              
              {nextPageToken && (
                <div className="mt-6 text-center">
                  <Button 
                    variant="outline" 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full max-w-sm mx-auto"
                  >
                    {loadingMore ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="mr-2 h-4 w-4" />
                    )}
                    {t.view_more_results || "View More Results"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="url" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {t.add_by_url || "Add by URL"}
              </CardTitle>
              <CardDescription>
                {t.url_description || "Paste a YouTube video URL to add it to your collection."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {addingUrl && (
                <div className="flex flex-col items-center justify-center py-8">
                  <FunLoader />
                  <p className="mt-4 text-sm text-gray-600">{t.adding || "Adding"}</p>
                </div>
              )}

              {!addingUrl && (
                <div className="space-y-2">
                  <Label htmlFor="youtube-url">{t.youtube_url || "YouTube URL"}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="youtube-url"
                      type="url"
                      placeholder={t.url_placeholder || "https://www.youtube.com/watch?v=..."}
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyDown={handleUrlEnter}
                      className="flex-1"
                    />
                    <Button onClick={handleAddByUrl} disabled={!youtubeUrl.trim()}>
                      {t.add_youtube_video || "Add YouTube Video"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
