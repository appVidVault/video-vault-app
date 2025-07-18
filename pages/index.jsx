
import Home from "./Home";
import Add from "./Add";
import Watch from "./Watch";
import Settings from "./Settings";
import Favorites from "./Favorites";
import MyPlaylists from "./MyPlaylists";
import ViewPlaylist from "./ViewPlaylist";
import Kids from "./kids.jsx";
import Share from "./Share";
import WatchLater from "./WatchLater";
import SearchVideos from "./SearchVideos";
import ShufflePlay from "./ShufflePlay";
import ContactUs from "./ContactUs.jsx/index.js";

export default {
  "/": { component: Home, index: true },
  "/home": { component: Home },
  "/add": { component: Add },
  "/watch": { component: Watch },
  "/settings": { component: Settings },
  "/favorites": { component: Favorites },
  "/my-playlists": { component: MyPlaylists },
  "/playlist": { component: ViewPlaylist },
  "/share": { component: Share },
  "/watch-later": { component: WatchLater },
  "/kids": { component: Kids },
  "/search": { component: SearchVideos },
  "/shuffle": { component: ShufflePlay },
  "/contact": { component: ContactUs }
};
