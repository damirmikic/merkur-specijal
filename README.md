# 🎲 Betting Events & Odds Viewer

A modern web application for viewing betting events and odds from Ladbrokes API.

## Features

- 📊 Fetch live betting events from Ladbrokes API
- 🎯 Interactive dropdown menu for event selection
- 💰 Display detailed odds for each betting market
- 🎨 Modern, responsive UI with gradient design
- ⚡ Real-time data loading with loading indicators
- 🛡️ Comprehensive error handling

## How It Works

### API Endpoints Used

1. **Events API**: `https://cms-prod.ladbrokes.com/cms/api/ladbrokes/fsc/16`
   - Fetches available betting events
   - Returns event IDs, names, dates, and competition details

2. **Odds API**: `https://ss-aka-ori.ladbrokes.com/openbet-ssviewer/Drilldown/2.86/EventToOutcomeForEvent/{eventId}`
   - Fetches odds for a specific event
   - Parameters: scorecast=true, translationLang=en, responseFormat=json, referenceEachWayTerms=true

### Usage Instructions

1. **Open the Application**
   - Open `index.html` in a web browser
   - Or serve it using a local web server (recommended for avoiding CORS issues)

2. **Load Events**
   - Click the "Load Events" button
   - The app will fetch all available betting events

3. **Select an Event**
   - Choose an event from the dropdown menu
   - Events are displayed with their name and date/time

4. **View Odds**
   - Once selected, odds for the event will load automatically
   - Odds are organized by betting market (e.g., Match Result, Over/Under, etc.)
   - Each outcome shows the selection name and current odds

## Running the App

### Option 1: Direct File Opening
Simply open `index.html` in your browser:
```bash
open index.html
```

### Option 2: Local Web Server (Recommended)
Using Python:
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000`

Using Node.js:
```bash
npx http-server
```

Using PHP:
```bash
php -S localhost:8000
```

## CORS Considerations

The Ladbrokes APIs may have CORS restrictions. If you encounter CORS errors:

1. **Use a CORS proxy** (for development only):
   - Add a proxy URL before the API endpoint
   - Example: `https://cors-anywhere.herokuapp.com/`

2. **Use browser extensions**:
   - Install a CORS extension like "CORS Unblock" (Chrome/Edge)
   - "CORS Everywhere" (Firefox)

3. **Server-side proxy** (production recommended):
   - Create a backend server that proxies requests
   - This avoids CORS issues entirely

## Technical Details

### File Structure
```
merkur-specijal/
├── index.html      # Main HTML structure
├── styles.css      # Styling and animations
├── app.js          # Application logic and API calls
└── README.md       # This file
```

### Technologies Used
- Pure HTML5, CSS3, and JavaScript (ES6+)
- Fetch API for HTTP requests
- CSS Grid and Flexbox for layout
- CSS animations for smooth transitions

### Key Features of the Code

1. **Adaptive Data Parsing**: The app intelligently handles different API response structures
2. **Error Handling**: Comprehensive try-catch blocks and user-friendly error messages
3. **Loading States**: Visual feedback during API calls
4. **Responsive Design**: Works on desktop, tablet, and mobile devices
5. **Clean Code**: Well-structured, commented, and maintainable

## Customization

### Changing the Events Source
Edit the `EVENTS_API` constant in `app.js`:
```javascript
const EVENTS_API = 'your-events-api-url';
```

### Modifying Odds Parameters
Edit the odds URL construction in the `loadOdds()` function:
```javascript
const oddsUrl = `${ODDS_API_BASE}${eventId}?scorecast=true&translationLang=en&responseFormat=json`;
```

### Styling
All visual styles are in `styles.css`. Key customization points:
- Color scheme: Update the gradient colors
- Layout: Modify grid columns in `.outcomes-grid`
- Typography: Change font-family in `body`

## Troubleshooting

### Events Not Loading
- Check browser console for error messages
- Verify the API endpoint is accessible
- Check for CORS issues (see CORS Considerations above)

### Odds Not Displaying
- Ensure the event ID is valid
- Check if the odds API is accessible
- Verify the event has available betting markets

### Browser Compatibility
- Requires modern browser with ES6+ support
- Tested on Chrome, Firefox, Safari, Edge
- Minimum versions: Chrome 60+, Firefox 60+, Safari 12+, Edge 79+

## Development

To extend this application:

1. **Add more betting markets**: Modify the `parseMarkets()` function
2. **Implement betting slip**: Add state management for selected bets
3. **Add filters**: Filter events by sport, date, or competition
4. **Persistence**: Use localStorage to remember user preferences

## License

This is a demonstration project for educational purposes.

## Support

For issues or questions, please check:
- Browser console for detailed error messages
- Network tab to inspect API requests/responses
- Ensure APIs are accessible from your location
