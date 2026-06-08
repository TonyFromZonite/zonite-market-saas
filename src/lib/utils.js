// Ré-export vers utils.ts — certains fichiers (index.css, ui/input.jsx, etc.)
// référencent encore explicitement utils.js. On garde ce shim pour compatibilité.
export { cn } from "./utils.ts";
