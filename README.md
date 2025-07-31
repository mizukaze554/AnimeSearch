# animeserc

**animeserc** is a Progressive Web App (PWA) for searching anime by title, context, image, or filtering by genres. It leverages the [Jikan API](https://jikan.moe/) (MyAnimeList unofficial API) and [trace.moe](https://trace.moe/) image search API for rich and interactive anime search experience.

---

## Features

- Search anime by text with autocomplete suggestions and recent search history
- Filter results by multiple genres selection
- Search anime by uploading an image (using trace.moe)
- View detailed anime information including synopsis, genres, characters, episodes, status, score, and embedded trailers
- Favorites list to save your preferred anime titles locally
- Infinite scroll for loading more search results
- Offline support via Service Worker caching (PWA)
- Responsive UI built with Tailwind CSS and smooth animations
- Modal popup for detailed anime info with scrollable content and click outside to close

---

## Demo

https://animeserc.netlify.app/

---

## Usage

1. Open the app in a modern browser.
2. Use the search box to type anime names. Suggestions from your search history appear after typing 3+ characters.
3. Select genres by checking boxes in the filter panel to narrow down search results.
4. Click **Search** or press Enter to query anime from the API.
5. Scroll down to load more results automatically.
6. Click **View** on any anime to open the detail modal.
7. Add favorites by clicking the ❤ button; favorites are saved locally.
8. Upload an image to search anime by visual similarity.
9. Close the modal by clicking the ✕ or clicking outside the modal area.

---

## Development

### Tech stack

- **HTML5** + **Tailwind CSS** for the frontend UI styling
- **Vanilla JavaScript** for all dynamic functionality and API interactions
- **Jikan API** for anime data (`https://api.jikan.moe/v4`)
- **trace.moe API** for anime image search (`https://api.trace.moe/search`)
- **Service Worker** and **Web Manifest** to enable PWA features

### Folder structure

