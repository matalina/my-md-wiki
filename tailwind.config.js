const colors = require('tailwindcss/colors')

module.exports = {
    purge: [
        "./**/*.svelte",  // Look for .svelte files
        "./**/*.html" // Look for .html files
    ],
    darkMode: false, // or 'media' or 'class'
    theme: {
        extend: {},
        colors: {
            ...colors,
        }
    },
    variants: {},
    plugins: [],
}