// Apply the stored theme before anything renders. This runs as the first
// statement of the first script (loaded at the end of <body>, so body exists),
// well before the DOMContentLoaded init — waiting until then gave dark-mode
// users a white flash on every load.
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// --- Constants ---
const INITIAL_BOX_WIDTH = 200;
const INITIAL_BOX_HEIGHT = 80;
const LINE_HEIGHT = 23; // Height per line in pixels
const PADDING_HEIGHT = 30; // Additional padding for box height

// Width type constants
const WIDTH_TYPES = { SMALL: 'small', MEDIUM: 'medium', LARGE: 'large' };

// Text alignment cycle for the 'a' key (order is the UX contract)
const TEXT_ALIGNMENTS = ['left', 'justify', 'center', 'right'];

// Shape cycle for the 's' key (order is the UX contract).
// contentWidthRatio: fraction of the box width the content may occupy so it
// stays inside the outline; heightRatio: box height per measured content
// height (an ellipse needs ~sqrt(2) headroom, diamond/triangle ~2x).
const BOX_SHAPES = ['rectangle', 'rounded', 'circle', 'diamond', 'triangle'];
const SHAPE_CONFIG = {
    rectangle: { contentWidthRatio: 1.0,  heightRatio: 1.0 },
    rounded:   { contentWidthRatio: 1.0,  heightRatio: 1.0 },
    circle:    { contentWidthRatio: 0.71, heightRatio: 1.41 },
    diamond:   { contentWidthRatio: 0.62, heightRatio: 1.68 },
    triangle:  { contentWidthRatio: 0.60, heightRatio: 1.85 },
};
const WIDTH_TYPE_VALUES = { [WIDTH_TYPES.SMALL]: 200, [WIDTH_TYPES.MEDIUM]: 350, [WIDTH_TYPES.LARGE]: 500 };

// Separated connection style constants
const CONNECTION_PATTERNS = {
    NORMAL: 'normal',
    DASHED: 'dashed',
    DOTTED: 'dotted'
};

const CONNECTION_THICKNESSES = {
    THIN: 'thin',
    NORMAL: 'normal',
    BOLD: 'bold'
};

// Enhanced color theme configuration with light and dark variants
const COLOR_THEMES = {
    default: {
        name: 'Default',
        light: {
            bg: 'light-default-bg',
            border: 'light-default-border',
            text: 'light-default-text',
            stroke: 'var(--theme-default-stroke)'
        },
        dark: {
            bg: 'dark-default-bg',
            border: 'dark-default-border',
            text: 'dark-default-text',
            stroke: 'var(--theme-default-stroke)'
        }
    },
    red: {
        name: 'Red',
        light: {
            bg: 'light-red-bg',
            border: 'light-red-border',
            text: 'light-red-text',
            stroke: 'var(--theme-red-stroke)'
        },
        dark: {
            bg: 'dark-red-bg',
            border: 'dark-red-border',
            text: 'dark-red-text',
            stroke: 'var(--theme-red-stroke)'
        }
    },
    green: {
        name: 'Green',
        light: {
            bg: 'light-green-bg',
            border: 'light-green-border',
            text: 'light-green-text',
            stroke: 'var(--theme-green-stroke)'
        },
        dark: {
            bg: 'dark-green-bg',
            border: 'dark-green-border',
            text: 'dark-green-text',
            stroke: 'var(--theme-green-stroke)'
        }
    },
    blue: {
        name: 'Blue',
        light: {
            bg: 'light-blue-bg',
            border: 'light-blue-border',
            text: 'light-blue-text',
            stroke: 'var(--theme-blue-stroke)'
        },
        dark: {
            bg: 'dark-blue-bg',
            border: 'dark-blue-border',
            text: 'dark-blue-text',
            stroke: 'var(--theme-blue-stroke)'
        }
    },
    purple: {
        name: 'Purple',
        light: {
            bg: 'light-purple-bg',
            border: 'light-purple-border',
            text: 'light-purple-text',
            stroke: 'var(--theme-purple-stroke)'
        },
        dark: {
            bg: 'dark-purple-bg',
            border: 'dark-purple-border',
            text: 'dark-purple-text',
            stroke: 'var(--theme-purple-stroke)'
        }
    },
    yellow: {
        name: 'Yellow',
        light: {
            bg: 'light-yellow-bg',
            border: 'light-yellow-border',
            text: 'light-yellow-text',
            stroke: 'var(--theme-yellow-stroke)'
        },
        dark: {
            bg: 'dark-yellow-bg',
            border: 'dark-yellow-border',
            text: 'dark-yellow-text',
            stroke: 'var(--theme-yellow-stroke)'
        }
    },
    grey: {
        name: 'Grey',
        light: {
            bg: 'light-grey-bg',
            border: 'light-grey-border',
            text: 'light-grey-text',
            stroke: 'var(--theme-grey-stroke)'
        },
        dark: {
            bg: 'dark-grey-bg',
            border: 'dark-grey-border',
            text: 'dark-grey-text',
            stroke: 'var(--theme-grey-stroke)'
        }
    }
};

// Get all theme keys for cycling
const THEME_KEYS = Object.keys(COLOR_THEMES);

// Define base classes for reuse in JS - using Tailwind utility classes
const BASE_BOX_CLASSES = 'absolute rounded-lg box-default cursor-move no-select py-2 px-3 pointer-events-auto overflow-hidden box-transition';
