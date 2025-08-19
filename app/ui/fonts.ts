// Using CSS-based font loading as fallback for build issues
// This ensures the app builds successfully even when Google Fonts aren't accessible

export const inter = {
  className: 'font-sans',
  style: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }
};

export const lusitana = {
  className: 'font-serif',
  style: {
    fontFamily: 'Lusitana, Georgia, "Times New Roman", serif'
  }
};