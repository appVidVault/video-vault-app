import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import {
  Home,
  Settings,
  Star,
  ListVideo,
  Search,
  Users,
  Bookmark,
  Menu,
  LibraryBig,
  ChevronDown,
  PlusCircle,
  ImageIcon,
  BookOpenCheck, // New Icon
} from 'lucide-react';
import { User } from '@/entities/User';
import { UserSettings } from '@/entities/UserSettings';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import LanguageSelector from "./components/LanguageSelector";
import { LanguageProvider, useTranslation } from './components/LanguageProvider';
import { OfflineIndicator } from './components/NetworkErrorHandler';

// Define custom styles for each theme that will be applied directly
const themeStyles = {
  default: {
    body: {
      backgroundColor: '#ffffff',
      color: '#0f172a'
    },
    header: {
      backgroundColor: '#ffffff',
      color: '#0f172a',
      borderColor: '#e2e8f0'
    }
  },
  dark: {
    body: {
      backgroundColor: '#1e40af',
      color: '#e0f2fe'
    },
    header: {
      backgroundColor: '#2563eb',
      color: '#e0f2fe',
      borderColor: '#60a5fa'
    }
  },
  blue: {
    body: {
      backgroundColor: '#f0f7ff',
      color: '#0c4a6e'
    },
    header: {
      backgroundColor: '#e0f2fe',
      color: '#0c4a6e',
      borderColor: '#bae6fd'
    }
  },
  green: {
    body: {
      backgroundColor: '#f0fff4',
      color: '#14532d'
    },
    header: {
      backgroundColor: '#dcfce7',
      color: '#14532d',
      borderColor: '#a7f3d0'
    }
  },
  purple: {
    body: {
      backgroundColor: '#f5f3ff',
      color: '#4c1d95'
    },
    header: {
      backgroundColor: '#ede9fe',
      color: '#4c1d95',
      borderColor: '#e9d5ff'
    }
  },
  warm: {
    body: {
      backgroundColor: '#fffbeb',
      color: '#7c2d12'
    },
    header: {
      backgroundColor: '#ffedd5',
      color: '#7c2d12',
      borderColor: '#fed7aa'
    }
  },
  cool: {
    body: {
      backgroundColor: '#f0fdfa',
      color: '#134e4a'
    },
    header: {
      backgroundColor: '#ccfbf1',
      color: '#134e4a',
      borderColor: '#a5f3fc'
    }
  }
};

// NavLink component
const NavLink = ({ to, children, icon: Icon, className = "", isIconOnly = false }) => {
  return (
    <Link to={to}>
      <Button
        variant="ghost"
        className={`hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ${className}`}
      >
        {Icon && <Icon className={`h-5 w-5 ${children && !isIconOnly ? "mr-2" : ""}`} />}
        {(!Icon || !isIconOnly) && children}
      </Button>
    </Link>
  );
};

const LayoutContent = ({ children, currentPageName }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, language } = useTranslation();
  const [currentTheme, setCurrentTheme] = useState('default');
  const headerRef = useRef(null);
  const [isInKidsMode, setIsInKidsMode] = useState(false);
  const [isWatchPageFullscreen, setIsWatchPageFullscreen] = useState(false); // New state

  const isMediaPage = ["Watch", "KidsWatch", "ViewAlbum", "Slideshow"].includes(currentPageName);

  useEffect(() => {
    const kidsQueryParam = new URLSearchParams(window.location.search).get('kids') === 'true';
    const isBodyKidsMode = document.body.classList.contains('kids-mode-active');

    const currentIsInKidsMode = (currentPageName === "Kids") ||
                                (isMediaPage && kidsQueryParam) ||
                                (isMediaPage && isBodyKidsMode);
    setIsInKidsMode(currentIsInKidsMode);

    // Initial check for watch page fullscreen
    setIsWatchPageFullscreen(document.body.classList.contains('watch-page-fullscreen'));

    const observer = new MutationObserver(() => {
      const updatedIsBodyKidsMode = document.body.classList.contains('kids-mode-active');
      const updatedCurrentIsInKidsMode = (currentPageName === "Kids") ||
                                         (isMediaPage && new URLSearchParams(window.location.search).get('kids') === 'true') ||
                                         (isMediaPage && updatedIsBodyKidsMode);
      setIsInKidsMode(updatedCurrentIsInKidsMode);
      setIsWatchPageFullscreen(document.body.classList.contains('watch-page-fullscreen'));
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
    };
  }, [currentPageName, location.search, isMediaPage]);


  // Function to apply theme
  const applyThemeToPage = (themeName) => {
    const theme = themeStyles[themeName] || themeStyles.default;
    Object.assign(document.body.style, theme.body); // Apply to body
    if (headerRef.current) {
      Object.assign(headerRef.current.style, theme.header);
    }
    localStorage.setItem('video-vault-theme', themeName);
    setCurrentTheme(themeName);
    window.applyTheme = (newTheme) => applyThemeToPage(newTheme);
  };


  useEffect(() => {
    const initSettings = async () => {
      let finalTheme = 'default';

      try {
        const user = await User.me().catch(() => null);
        if (user) {
          const settings = await UserSettings.filter({ created_by: user.email });
          if (settings && settings.length > 0 && settings[0]) {
             if (settings[0].theme) finalTheme = settings[0].theme;
          }
        } else {
            const savedTheme = localStorage.getItem('video-vault-theme');
            if (savedTheme) finalTheme = savedTheme;
        }
      } catch (error) {
        console.warn('Could not load user settings, using localStorage fallbacks:', error);
        const savedTheme = localStorage.getItem('video-vault-theme');
        if (savedTheme) finalTheme = savedTheme;
      }
      
      applyThemeToPage(finalTheme);
    };
    initSettings();
  }, []);

  useEffect(() => {
    // Re-apply header style when theme changes or headerRef becomes available
    if (headerRef.current && currentTheme) {
        const theme = themeStyles[currentTheme] || themeStyles.default;
        Object.assign(headerRef.current.style, theme.header);
    }
  }, [currentTheme, headerRef.current]);

  // Determine if the main app header and footer should be shown
  const showAppShell = !isInKidsMode && !(isMediaPage && isWatchPageFullscreen);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Include the offline indicator */}
      <OfflineIndicator />

      {showAppShell && (
        <header
          ref={headerRef}
          className="sticky top-0 z-50 border-b"
        >
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex-1 md:flex-none">
              <Link to={createPageUrl("Home")} className="inline-flex items-center">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/0f9eb9_image.png"
                  alt="VideoVault Logo"
                  className="h-8 w-auto"
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              <NavLink to={createPageUrl("Home")} icon={Home}>
                {t.home}
              </NavLink>
              <NavLink to={createPageUrl("Add")} icon={Search}>
                {t.search}
              </NavLink>
              <NavLink to={createPageUrl("PhotoGallery")} icon={ImageIcon}>
                {t.photos}
              </NavLink>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0">
                    <LibraryBig className="h-5 w-5 mr-1" />
                    {t.library}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("MyPlaylists")} className="flex items-center hover:bg-gray-100/50">
                      <ListVideo className="h-4 w-4 mr-2" />
                      {t.my_playlists}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("PublicLibrary")} className="flex items-center hover:bg-gray-100/50">
                      <BookOpenCheck className="h-4 w-4 mr-2" />
                      {t.public_library}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Favorites")} className="flex items-center hover:bg-gray-100/50">
                      <Star className="h-4 w-4 mr-2" />
                      {t.favorites}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("WatchLater")} className="flex items-center hover:bg-gray-100/50">
                      <Bookmark className="h-4 w-4 mr-2" />
                      {t.watch_later}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <NavLink to={createPageUrl("Kids")} icon={Users}>
                {t.kids_mode}
              </NavLink>

              <LanguageSelector />

              <NavLink to={createPageUrl("Settings")} icon={Settings} isIconOnly={true} />
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden flex items-center gap-2">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>
                       <div className="h-10 mb-4 flex items-center pl-4">
                          <Link to={createPageUrl("Home")} className="inline-flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
                            <img
                              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/0f9eb9_image.png"
                              alt="VideoVault Logo"
                              className="h-7 w-auto"
                            />
                          </Link>
                       </div>
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col space-y-1 mt-4">
                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("Home")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Home className="h-5 w-5 mr-3" />
                        {t.home}
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("Add")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Search className="h-5 w-5 mr-3" />
                        {t.search}
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("PhotoGallery")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <ImageIcon className="h-5 w-5 mr-3" />
                        {t.photos}
                      </Link>
                    </SheetClose>

                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("MyPlaylists")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <ListVideo className="h-5 w-5 mr-3" />
                        {t.my_playlists}
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("PublicLibrary")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <BookOpenCheck className="h-5 w-5 mr-3" />
                        {t.public_library}
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("Favorites")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Star className="h-5 w-5 mr-3" />
                        {t.favorites}
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("WatchLater")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Bookmark className="h-5 w-5 mr-3" />
                        {t.watch_later}
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("Kids")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Users className="h-5 w-5 mr-3" />
                        {t.kids_mode}
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to={createPageUrl("Settings")}
                        className="flex items-center px-4 py-2 hover:bg-gray-100/50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Settings className="h-5 w-5 mr-3" />
                        {t.settings}
                      </Link>
                    </SheetClose>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1" style={themeStyles[currentTheme]?.body || themeStyles.default.body}>
        {children}
      </main>

      {showAppShell && (
        <footer className="border-t py-6" style={themeStyles[currentTheme]?.header || themeStyles.default.header}>
          <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              © {new Date().getFullYear()} VideoVault. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link to={createPageUrl("ContactUs")} className="hover:underline">
                {t.contact_us}
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default function Layout({ children, currentPageName }) {
  return (
    <LanguageProvider>
      <LayoutContent currentPageName={currentPageName}>{children}</LayoutContent>
    </LanguageProvider>
  );
}
