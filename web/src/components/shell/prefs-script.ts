// Script inline exécuté dans <head> avant le premier rendu : applique le thème et l'état de la barre
// latérale enregistrés (localStorage), pour éviter tout flash. Module neutre (importable côté serveur).
export const PREFS_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);if(localStorage.getItem("sidebar")==="collapsed")d.setAttribute("data-sidebar","collapsed")}catch(e){}})()`;
