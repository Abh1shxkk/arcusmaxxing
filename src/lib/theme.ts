// Runs before first paint (see app/layout.tsx) so a saved theme never flashes the wrong colours.
export const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
