import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1600px" },
    },
    extend: {
      colors: {
        // Paleta Turno Fijo. Sin colores fuera de esta lista.
        sillon: "#0F0E0D", // fondo
        carbon: "#1B1A18", // superficie
        grafito: "#262421", // superficie elevada
        linea: "#38352F", // borde / separador 1px
        crema: "#F0EAE0", // texto principal
        ceniza: "#9C948A", // texto secundario
        oro: "#C79A45", // acento: dinero / estado destacado
        cobre: "#A65A2E", // accion primaria
        navaja: "#6F7F52", // pagado
        ladrillo: "#8C3B2E", // cancelado

        // Alias semanticos usados por los componentes tipo shadcn/ui.
        background: "#0F0E0D",
        foreground: "#F0EAE0",
        card: "#1B1A18",
        muted: "#262421",
        "muted-foreground": "#9C948A",
        border: "#38352F",
        input: "#38352F",
        ring: "#C79A45",
        primary: "#A65A2E",
        "primary-foreground": "#F0EAE0",
        secondary: "#262421",
        "secondary-foreground": "#F0EAE0",
        accent: "#C79A45",
        "accent-foreground": "#0F0E0D",
        destructive: "#8C3B2E",
        "destructive-foreground": "#F0EAE0",
      },
      fontFamily: {
        // Bodoni Moda -> titulares. Archivo -> interfaz. IBM Plex Mono -> datos.
        display: ["var(--font-bodoni)", "Georgia", "serif"],
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // Regla 03 del sistema: radios de 0 a 4px.
        none: "0px",
        sm: "2px",
        DEFAULT: "3px",
        md: "3px",
        lg: "4px",
        xl: "4px",
      },
      letterSpacing: {
        etiqueta: "0.14em",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 140ms ease-out",
        "slide-up": "slide-up 180ms ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
