import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Video } from "@/entities/Video";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "../components/LanguageProvider";
import {
  ChevronLeft,
  Film,
  Loader2,
  Upload,
  X,
  CheckCircle2,
  Pause,
  Play
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FunLoader from "../components/FunLoader";
import { chunkedUpload } from "@/functions/chunkedUpload";
import { Progress } from "@/components/ui/progress";

// --- New Uploader Configuration ---
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
const PARALLEL_UPLOADS = 4; // Number of chunks to upload simultaneously

export default function UploadVideos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("single");

  // State for uploads (both single and batch)
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUploads, setCurrentUploads] = useState({});

  const processUploadQueue = async () => {
    if (isPaused || uploadQueue.length === 0) {
      if(uploadQueue.length === 0) setIsUploading(false);
      return;
    }

    setIsUploading(true);
    
    const fileToUpload = uploadQueue[0];
    
    // Set up progress tracking for this file
    setCurrentUploads(prev => ({
        ...prev,
        [fileToUpload.id]: {
            ...fileToUpload,
            progress: 0,
            status: 'uploading'
        }
    }));

    const totalChunks = Math.ceil(fileToUpload.file.size / CHUNK_SIZE);
    const chunkPromises = [];

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileToUpload.file.size);
        const chunk = fileToUpload.file.slice(start, end);
        
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', totalChunks);
        formData.append('fileName', fileToUpload.file.name);
        formData.append('fileType', fileToUpload.file.type);
        formData.append('fileId', fileToUpload.id);
        
        chunkPromises.push(() => chunkedUpload(formData));
    }

    let completedChunks = 0;
    let finalUrl = null;
    let hasError = false;

    const worker = async () => {
        while (chunkPromises.length > 0) {
            if (isPaused) {
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
            const promise = chunkPromises.shift();
            if(promise){
                try {
                    const { data } = await promise();
                    if(data.status === 'completed') {
                        finalUrl = data.file_url;
                    }
                    completedChunks++;
                    const progress = Math.round((completedChunks / totalChunks) * 100);
                    
                    setCurrentUploads(prev => ({
                        ...prev,
                        [fileToUpload.id]: {
                            ...prev[fileToUpload.id],
                            progress
                        }
                    }));
                } catch(e) {
                    hasError = true;
                    console.error("Chunk upload failed", e);
                    chunkPromises.unshift(promise); // Re-add failed chunk for retry
                    await new Promise(resolve => setTimeout(resolve, 2000)); // wait before retry
                }
            }
        }
    };
    
    const workers = Array(PARALLEL_UPLOADS).fill(null).map(worker);
    await Promise.all(workers);

    if(!hasError && finalUrl) {
       let thumbnailUrl = null;
       if(fileToUpload.thumbnail.file) {
          const { file_url } = await chunkedUpload({
             file: fileToUpload.thumbnail.file
          });
          thumbnailUrl = file_url;
       }
        
       await Video.create({
            title: fileToUpload.title.trim(),
            sourceType: 'upload',
            fileUrl: finalUrl,
            thumbnail: thumbnailUrl,
            dateAdded: new Date().toISOString(),
        });
        
        setCurrentUploads(prev => ({
            ...prev,
            [fileToUpload.id]: {
                ...prev[fileToUpload.id],
                status: 'completed'
            }
        }));

    } else {
        setCurrentUploads(prev => ({
            ...prev,
            [fileToUpload.id]: {
                ...prev[fileToUpload.id],
                status: 'failed'
            }
        }));
    }
    
    setUploadQueue(prev => prev.slice(1));
  };
  
  useEffect(() => {
    if (isUploading && !isPaused) {
      processUploadQueue();
    }
  }, [uploadQueue, isUploading, isPaused]);

  const addFilesToQueue = async (files) => {
    const newUploads = [];
    for (const file of files) {
        if (file.size > 200 * 1024 * 1024) { // Increased limit to 200MB
            toast({
                title: "File too large",
                description: `${file.name} exceeds the 200MB limit.`,
                variant: "destructive",
            });
            continue;
        }

        const thumb = await generateThumbnail(file);
        
        newUploads.push({
            id: `${Date.now()}-${Math.random()}`,
            file,
            title: file.name.replace(/\.[^/.]+$/, ""),
            thumbnail: {
                previewUrl: thumb.previewUrl,
                file: thumb.file
            }
        });
    }
    setUploadQueue(prev => [...prev, ...newUploads]);
    if(!isUploading) setIsUploading(true);
  };
  
  const generateThumbnail = (file) => {
    return new Promise((resolve) => {
      // Logic from previous implementation to generate thumbnail
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.onloadeddata = () => {
          video.currentTime = 1;
      };
      video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
              resolve({
                  previewUrl: URL.createObjectURL(blob),
                  file: new File([blob], "thumbnail.jpg", { type: "image/jpeg" })
              });
          }, 'image/jpeg');
      };
      video.onerror = () => resolve({ previewUrl: null, file: null });
    });
  };

  const updateFileTitle = (id, newTitle) => {
    setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, title: newTitle } : item));
    setCurrentUploads(prev => ({ ...prev, [id]: { ...prev[id], title: newTitle } }));
  };
  
  const removeFileFromQueue = (id) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
    setCurrentUploads(prev => {
        const newCurrents = { ...prev };
        delete newCurrents[id];
        return newCurrents;
    });
  };

  const handleAllUploadsComplete = () => {
      const successfulUploads = Object.values(currentUploads).filter(u => u.status === 'completed').length;
      if (successfulUploads > 0) {
          toast({
              title: "Uploads Complete",
              description: `${successfulUploads} video(s) uploaded successfully.`,
          });
          navigate(createPageUrl("Home"));
      } else {
          toast({
              title: "Uploads Finished",
              description: "No videos were successfully uploaded.",
              variant: "destructive"
          });
      }
      setCurrentUploads({});
      setIsUploading(false);
  };

  useEffect(() => {
    if (!isUploading && Object.keys(currentUploads).length > 0) {
      handleAllUploadsComplete();
    }
  }, [isUploading, currentUploads]);

  const renderUploadList = () => (
      <div className="space-y-4">
          {Object.values(currentUploads).map(item => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                   <div className="flex items-start gap-3">
                       {item.thumbnail.previewUrl && 
                           <img src={item.thumbnail.previewUrl} alt="preview" className="w-24 h-14 object-cover rounded"/>
                       }
                       <div className="flex-1">
                           <Input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateFileTitle(item.id, e.target.value)}
                                className="w-full text-sm mb-1"
                                placeholder="Enter video title"
                                disabled={item.status === 'uploading' || item.status === 'completed'}
                           />
                           <p className="text-xs text-gray-500 truncate">{item.file.name}</p>
                       </div>
                       {item.status !== 'uploading' && item.status !== 'completed' &&
                           <Button size="icon" variant="ghost" onClick={() => removeFileFromQueue(item.id)}><X className="h-4 w-4"/></Button>
                       }
                   </div>
                  {item.status === 'uploading' && (
                       <>
                           <Progress value={item.progress} className="w-full" />
                           <p className="text-xs text-blue-600">{item.progress}% uploaded</p>
                       </>
                   )}
                   {item.status === 'completed' && <p className="text-xs text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/>Upload complete</p>}
                   {item.status === 'failed' && <p className="text-xs text-red-600">Upload failed. It will be retried.</p>}
              </div>
          ))}
          {uploadQueue.filter(i => !currentUploads[i.id]).map(item => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                 <div className="flex items-start gap-3">
                     {item.thumbnail.previewUrl && 
                         <img src={item.thumbnail.previewUrl} alt="preview" className="w-24 h-14 object-cover rounded"/>
                     }
                     <div className="flex-1">
                         <Input
                              type="text"
                              value={item.title}
                              onChange={(e) => updateFileTitle(item.id, e.target.value)}
                              className="w-full text-sm mb-1"
                          />
                          <p className="text-xs text-gray-500">{item.file.name}</p>
                     </div>
                     <Button size="icon" variant="ghost" onClick={() => removeFileFromQueue(item.id)}><X className="h-4 w-4"/></Button>
                 </div>
                 <p className="text-xs text-gray-500">Waiting in queue...</p>
              </div>
          ))}
      </div>
  );

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Link 
          to={createPageUrl("Home")} 
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Home
        </Link>
        <h1 className="text-3xl font-bold mb-2">Upload Personal Videos</h1>
        <p className="text-gray-600">Upload videos from your device. Faster, more reliable uploads.</p>
      </div>

       <Card>
          <CardHeader>
              <CardTitle>Upload Manager</CardTitle>
              <CardDescription>Add files to the queue. Uploads will start automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                  <Label htmlFor="video-files">Add Video Files (Max 200MB each)</Label>
                  <Input
                      id="video-files"
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      multiple
                      onChange={(e) => addFilesToQueue(e.target.files)}
                      disabled={isUploading && !isPaused}
                  />
              </div>

              {(uploadQueue.length > 0 || Object.keys(currentUploads).length > 0) && (
                  <div className="space-y-4">
                      <Separator />
                      <div className="flex justify-between items-center">
                          <h3 className="font-medium">Upload Queue ({uploadQueue.length + Object.keys(currentUploads).length})</h3>
                          {isUploading && (
                              <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)}>
                                  {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                                  {isPaused ? "Resume" : "Pause"}
                              </Button>
                          )}
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {renderUploadList()}
                      </div>
                  </div>
              )}
          </CardContent>
       </Card>
    </div>
  );
}