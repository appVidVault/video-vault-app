import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import YouTubeSearch from "../components/YouTubeSearch";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SearchVideosPage() {
  const navigate = useNavigate();

  const handleVideoAdded = (video) => {
    // Optionally show a toast or notification that video was added
    // Could navigate to home or the new video's watch page
    // navigate(createPageUrl("Home")); 
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("Home")} aria-label="Back to Home">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Search YouTube</h1>
          <p className="text-gray-500 mt-1">Find videos on YouTube and add them directly to your VideoVault.</p>
        </div>
      </div>
      
      <Card className="max-w-5xl mx-auto shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <YouTubeSearch onVideoAdded={handleVideoAdded} />
        </CardContent>
      </Card>
    </div>
  );
}