// API Endpoints - Using Netlify Functions to bypass CORS
const EVENTS_API = '/.netlify/functions/get-events';
const ODDS_API_BASE = '/.netlify/functions/get-odds';

// State
let events = [];
let currentEventData = null;

// DOM Elements
const loadEventsBtn = document.getElementById('loadEventsBtn');
const eventSection = document.getElementById('eventSection');
const eventSelect = document.getElementById('eventSelect');
const oddsSection = document.getElementById('oddsSection');
const oddsContainer = document.getElementById('oddsContainer');
const errorMessage = document.getElementById('errorMessage');
const loadingMessage = document.getElementById('loadingMessage');

// Event Listeners
loadEventsBtn.addEventListener('click', loadEvents);
eventSelect.addEventListener('change', handleEventSelection);

// Show/Hide Elements
function showElement(element) {
    element.style.display = 'block';
}

function hideElement(element) {
    element.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    showElement(errorMessage);
    setTimeout(() => hideElement(errorMessage), 5000);
}

function showLoading() {
    showElement(loadingMessage);
}

function hideLoading() {
    hideElement(loadingMessage);
}

function setButtonLoading(isLoading) {
    const btnText = loadEventsBtn.querySelector('.btn-text');
    const loader = loadEventsBtn.querySelector('.loader');

    if (isLoading) {
        loadEventsBtn.disabled = true;
        btnText.textContent = 'Loading...';
        loader.style.display = 'inline-block';
    } else {
        loadEventsBtn.disabled = false;
        btnText.textContent = 'Load Events';
        loader.style.display = 'none';
    }
}

// Fetch Events
async function loadEvents() {
    setButtonLoading(true);
    hideElement(errorMessage);
    hideElement(oddsSection);

    try {
        const response = await fetch(EVENTS_API, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Events API Response:', data);

        // Parse the events from the response
        events = parseEvents(data);

        if (events.length === 0) {
            showError('No events found in the response');
            return;
        }

        populateEventDropdown();
        showElement(eventSection);

    } catch (error) {
        console.error('Error loading events:', error);
        showError(`Error loading events: ${error.message}. Please check browser console for details.`);
    } finally {
        setButtonLoading(false);
    }
}

// Parse events from API response
function parseEvents(data) {
    const eventsList = [];

    try {
        // Handle different possible response structures
        if (data.events && Array.isArray(data.events)) {
            return data.events;
        }

        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }

        if (Array.isArray(data)) {
            return data;
        }

        // Try to find events in nested structures
        if (data.fixture_schedule_content) {
            const content = data.fixture_schedule_content;
            if (content.events) {
                return Array.isArray(content.events) ? content.events : [content.events];
            }
        }

        // If we can't parse it, return the whole data wrapped in array
        if (data.id || data.eventId) {
            return [data];
        }

        // Try to extract from any property that looks like it contains events
        for (const key in data) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                const firstItem = data[key][0];
                if (firstItem.id || firstItem.eventId || firstItem.name) {
                    return data[key];
                }
            }
        }

    } catch (error) {
        console.error('Error parsing events:', error);
    }

    return eventsList;
}

// Populate dropdown with events
function populateEventDropdown() {
    eventSelect.innerHTML = '<option value="">-- Choose an event --</option>';

    events.forEach(event => {
        const option = document.createElement('option');
        const eventId = event.id || event.eventId || event.event_id;
        const eventName = event.name || event.title || event.event_name || `Event ${eventId}`;
        const eventDate = event.date || event.start_time || event.startTime || '';

        option.value = eventId;
        option.textContent = eventDate ? `${eventName} - ${formatDate(eventDate)}` : eventName;
        option.dataset.event = JSON.stringify(event);

        eventSelect.appendChild(option);
    });
}

// Format date
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// Handle event selection
async function handleEventSelection(e) {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const eventId = selectedOption.value;

    if (!eventId) {
        hideElement(oddsSection);
        return;
    }

    const eventData = JSON.parse(selectedOption.dataset.event);
    currentEventData = eventData;

    await loadOdds(eventId);
}

// Fetch odds for selected event
async function loadOdds(eventId) {
    showLoading();
    hideElement(errorMessage);
    hideElement(oddsSection);

    try {
        const oddsUrl = `${ODDS_API_BASE}?eventId=${eventId}`;

        const response = await fetch(oddsUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch odds: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Odds API Response:', data);

        displayOdds(data);
        showElement(oddsSection);

    } catch (error) {
        console.error('Error loading odds:', error);
        showError(`Error loading odds: ${error.message}. Please check browser console for details.`);
    } finally {
        hideLoading();
    }
}

// Display odds
function displayOdds(data) {
    oddsContainer.innerHTML = '';

    // Display event information
    const eventInfo = createEventInfo();
    if (eventInfo) {
        oddsContainer.appendChild(eventInfo);
    }

    try {
        // Parse markets and outcomes
        const markets = parseMarkets(data);

        if (markets.length === 0) {
            oddsContainer.innerHTML = '<div class="no-data">No betting markets available for this event</div>';
            return;
        }

        // Display each market
        markets.forEach(market => {
            const marketCard = createMarketCard(market);
            oddsContainer.appendChild(marketCard);
        });

    } catch (error) {
        console.error('Error displaying odds:', error);
        oddsContainer.innerHTML = '<div class="no-data">Error displaying odds data</div>';
    }
}

// Create event info display
function createEventInfo() {
    if (!currentEventData) return null;

    const div = document.createElement('div');
    div.className = 'event-info';

    const name = currentEventData.name || currentEventData.title || 'Event';
    const date = currentEventData.date || currentEventData.start_time || currentEventData.startTime;
    const competition = currentEventData.competition || currentEventData.league || '';

    div.innerHTML = `
        <h3>${name}</h3>
        ${date ? `<p><strong>Date:</strong> ${formatDate(date)}</p>` : ''}
        ${competition ? `<p><strong>Competition:</strong> ${competition}</p>` : ''}
    `;

    return div;
}

// Parse markets from odds response
function parseMarkets(data) {
    const marketsList = [];

    try {
        // Handle different response structures
        if (data.markets && Array.isArray(data.markets)) {
            return data.markets;
        }

        if (data.data && data.data.markets) {
            return Array.isArray(data.data.markets) ? data.data.markets : [data.data.markets];
        }

        if (data.SSResponse && data.SSResponse.markets) {
            return Array.isArray(data.SSResponse.markets) ? data.SSResponse.markets : [data.SSResponse.markets];
        }

        // Look for outcome structures
        if (data.outcomes || data.selections) {
            return [{
                name: 'Main Market',
                id: 'main',
                outcomes: data.outcomes || data.selections
            }];
        }

        // Try to find markets in nested structures
        for (const key in data) {
            if (data[key] && typeof data[key] === 'object') {
                if (data[key].markets) {
                    return Array.isArray(data[key].markets) ? data[key].markets : [data[key].markets];
                }
                if (Array.isArray(data[key]) && data[key].length > 0) {
                    const firstItem = data[key][0];
                    if (firstItem.outcomes || firstItem.selections || firstItem.name) {
                        return data[key];
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error parsing markets:', error);
    }

    return marketsList;
}

// Create market card
function createMarketCard(market) {
    const card = document.createElement('div');
    card.className = 'market-card';

    const marketName = market.name || market.market_name || market.type || 'Market';
    const outcomes = market.outcomes || market.selections || [];

    card.innerHTML = `
        <div class="market-title">${marketName}</div>
        <div class="outcomes-grid" id="outcomes-${market.id || Math.random()}"></div>
    `;

    const outcomesGrid = card.querySelector('.outcomes-grid');

    if (outcomes.length === 0) {
        outcomesGrid.innerHTML = '<div class="no-data">No outcomes available</div>';
    } else {
        outcomes.forEach(outcome => {
            const outcomeCard = createOutcomeCard(outcome);
            outcomesGrid.appendChild(outcomeCard);
        });
    }

    return card;
}

// Create outcome card
function createOutcomeCard(outcome) {
    const card = document.createElement('div');
    card.className = 'outcome-card';

    const name = outcome.name || outcome.selection || outcome.runner || 'Selection';
    const odds = formatOdds(outcome);

    card.innerHTML = `
        <div class="outcome-name">${name}</div>
        <div class="outcome-odds">${odds}</div>
    `;

    return card;
}

// Format odds
function formatOdds(outcome) {
    // Try different possible odds fields
    const oddsValue = outcome.odds ||
                     outcome.price ||
                     outcome.decimal_odds ||
                     outcome.decimalOdds ||
                     outcome.fractional_odds ||
                     outcome.fractionalOdds;

    if (oddsValue) {
        // If it's a decimal
        if (typeof oddsValue === 'number') {
            return oddsValue.toFixed(2);
        }
        return oddsValue;
    }

    // Try to find odds in nested structures
    if (outcome.price_data) {
        return formatOdds(outcome.price_data);
    }

    if (outcome.odds_data) {
        return formatOdds(outcome.odds_data);
    }

    return 'N/A';
}

// Initialize
console.log('Betting App Initialized');
console.log('Click "Load Events" to fetch available betting events');
