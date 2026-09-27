// Runs in <head> before first paint: applies a saved light theme so the page never flashes dark first.
// A ?theme=light or ?theme=dark link sets (and saves) the theme, so a view can be shared in either theme.
export const THEME_KEY = "fos:theme";
export const themeScript = `(function(){try{var q=new URLSearchParams(location.search).get('theme');if(q==='light'||q==='dark')localStorage.setItem('${THEME_KEY}',q);if(localStorage.getItem('${THEME_KEY}')==='light'){var c=document.documentElement.classList;c.remove('dark');c.add('light')}}catch(e){}})()`;
