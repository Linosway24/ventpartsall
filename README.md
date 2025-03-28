# Ventilator Parts Demonstration

A 3D web viewer for ventilator parts using Three.js. This project provides an interactive way to view and examine ventilator components in a web browser.

## Features

- Orthographic camera for accurate part visualization
- Responsive design that maintains proper scaling
- Clean, minimalist interface
- Optimized 3D model loading

## Setup

1. Clone the repository:
```bash
git clone [your-repo-url]
```

2. Open `index.html` in a web server (local or hosted)

## Technologies Used

- Three.js for 3D rendering
- GLTFLoader for 3D model loading
- Vanilla JavaScript for application logic

## Project Structure

- `main.js` - Main application code
- `index.html` - Entry point
- `assets/` - Contains 3D models and resources

## Development

To run locally:
1. Use a local web server (e.g., Live Server in VS Code)
2. Open index.html in your browser

## Files

- `index.html`: Main HTML structure
- `styles.css`: Styling for the 3D viewer
- `main.js`: Three.js scene setup and controls

## Notes for Articulate Storyline

- The viewer is responsive and will adapt to the Web Object's dimensions
- Interactions are handled through OrbitControls (rotate, pan, zoom)
- Background is set to black but can be modified in styles.css 