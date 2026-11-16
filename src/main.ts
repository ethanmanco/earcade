import "@fontsource/silkscreen/latin-400.css";
import "@fontsource/silkscreen/latin-700.css";
import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { App } from "./ui/app";

new App(document.getElementById("app")!).start();

// Works offline once loaded, and installs to the home screen.
registerSW({ immediate: true });
