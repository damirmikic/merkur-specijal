// API Endpoints - Using Netlify Functions to bypass CORS
const EVENTS_API = '/.netlify/functions/get-events';
const ODDS_API_BASE = '/.netlify/functions/get-odds';

// State
let events = [];
let currentEventData = null;
let currentMarkets = []; // Store parsed markets for filtering

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
        // Ladbrokes API specific structure: modules[].data[]
        if (data.modules && Array.isArray(data.modules)) {
            // Extract events from all modules
            data.modules.forEach(module => {
                if (module.data && Array.isArray(module.data)) {
                    eventsList.push(...module.data);
                }
            });

            if (eventsList.length > 0) {
                return eventsList;
            }
        }

        // Fallback: Handle other possible response structures
        if (data.events && Array.isArray(data.events)) {
            return data.events;
        }

        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }

        if (Array.isArray(data)) {
            return data;
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
        const eventDate = event.startTime || event.date || event.start_time || '';
        const competition = event.typeName || event.className || '';

        option.value = eventId;

        // Build display text with competition and date
        let displayText = eventName;
        if (competition) {
            displayText = `${eventName} (${competition})`;
        }
        if (eventDate) {
            displayText += ` - ${formatDate(eventDate)}`;
        }

        option.textContent = displayText;
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
    
    // Clear any existing player filter
    const existingFilter = document.getElementById('playerFilterContainer');
    if(existingFilter) existingFilter.remove();

    // Display event information
    const eventInfo = createEventInfo();
    if (eventInfo) {
        oddsContainer.appendChild(eventInfo);
    }

    try {
        // Parse markets and outcomes
        const allMarkets = parseMarkets(data);

        // FILTER: Only show markets that contain "Player", "Goalscorer" or "Score" (for things like "To Score...")
        currentMarkets = allMarkets.filter(market => {
            const marketName = (market.name || '').toLowerCase();
            return marketName.includes('player') || 
                   marketName.includes('goalscorer') || 
                   marketName.includes('score');
        });

        if (currentMarkets.length === 0) {
            const noDiv = document.createElement('div');
            noDiv.className = 'no-data';
            noDiv.textContent = 'No player betting markets available for this event';
            oddsContainer.appendChild(noDiv);
            return;
        }

        // Setup the Player Filter Dropdown
        setupPlayerFilter(currentMarkets);

        // Display markets (initially show all filtered player markets)
        renderMarkets(currentMarkets);

    } catch (error) {
        console.error('Error displaying odds:', error);
        const errDiv = document.createElement('div');
        errDiv.className = 'no-data';
        errDiv.textContent = 'Error displaying odds data';
        oddsContainer.appendChild(errDiv);
    }
}

// Create and setup the player filter dropdown
function setupPlayerFilter(markets) {
    // Container for the filter
    const filterContainer = document.createElement('div');
    filterContainer.id = 'playerFilterContainer';
    filterContainer.style.marginBottom = '20px';
    filterContainer.style.padding = '10px';
    filterContainer.style.backgroundColor = '#f8f9fa';
    filterContainer.style.borderRadius = '5px';
    filterContainer.style.border = '1px solid #dee2e6';

    const label = document.createElement('label');
    label.textContent = 'Filter by Player: ';
    label.style.marginRight = '10px';
    label.style.fontWeight = 'bold';
    
    const select = document.createElement('select');
    select.id = 'playerSelect';
    select.style.padding = '5px';
    select.style.borderRadius = '4px';

    // Extract unique player names
    const players = new Set();
    markets.forEach(market => {
        market.outcomes.forEach(outcome => {
            const name = outcome.name;
            // Filter out generic outcomes to find real player names
            // Exclude Over/Under, Yes/No, and generic "No Goalscorer"
            if (name && 
                !['Over', 'Under', 'Yes', 'No'].includes(name) && 
                !name.includes('No Goalscorer') &&
                !name.includes('None') &&
                !name.includes('Draw')) {
                // If it's a name like "Salah to Score", we ideally want just "Salah", 
                // but usually outcomes in these markets ARE the player name (e.g. "Mohamed Salah")
                players.add(name);
            }
        });
    });

    // Sort players alphabetically
    const sortedPlayers = Array.from(players).sort();

    // Default option
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = '-- All Players --';
    select.appendChild(defaultOption);

    // Player options
    sortedPlayers.forEach(player => {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        select.appendChild(option);
    });

    // Add event listener
    select.addEventListener('change', (e) => {
        filterAndRenderMarkets(e.target.value);
    });

    filterContainer.appendChild(label);
    filterContainer.appendChild(select);

    // Insert before the markets list but after event info (handled by inserting at top of oddsContainer essentially via helper logic usually, but here we insert before oddsContainer in DOM or append to oddsContainer?)
    // current logic appends event info to oddsContainer. Let's insert this filter after event info.
    // The safest way given the structure is to insert it into oddsSection before oddsContainer
    oddsSection.insertBefore(filterContainer, oddsContainer);
}

// Filter markets based on selected player and render
function filterAndRenderMarkets(playerName) {
    // Clear existing markets from container (keep Event Info if we want, but simpler to rebuild or targeting just markets)
    // To identify markets vs info, we can clear everything and rebuild.
    oddsContainer.innerHTML = '';
    
    // Re-append event info
    const eventInfo = createEventInfo();
    if (eventInfo) {
        oddsContainer.appendChild(eventInfo);
    }

    if (playerName === 'all') {
        renderMarkets(currentMarkets);
        return;
    }

    const filteredMarkets = [];

    currentMarkets.forEach(market => {
        // We want to show this market if:
        // 1. The Market Name contains the player name (e.g. "Mohamed Salah Total Shots")
        // 2. OR One of the outcomes matches the player name
        
        const marketNameLower = market.name.toLowerCase();
        const playerLower = playerName.toLowerCase();
        
        const isPlayerSpecificMarket = marketNameLower.includes(playerLower);

        if (isPlayerSpecificMarket) {
            // Include the whole market (all outcomes, usually Yes/No or Over/Under)
            filteredMarkets.push(market);
        } else {
            // Check outcomes for the player
            const matchingOutcomes = market.outcomes.filter(outcome => 
                outcome.name === playerName
            );

            if (matchingOutcomes.length > 0) {
                // Clone market to not affect original state, but only with matching outcomes
                filteredMarkets.push({
                    ...market,
                    outcomes: matchingOutcomes
                });
            }
        }
    });

    if (filteredMarkets.length === 0) {
        const noData = document.createElement('div');
        noData.className = 'no-data';
        noData.textContent = `No markets available for ${playerName}`;
        oddsContainer.appendChild(noData);
    } else {
        renderMarkets(filteredMarkets);
    }
}

// Render a list of markets
function renderMarkets(markets) {
    markets.forEach(market => {
        const marketCard = createMarketCard(market);
        oddsContainer.appendChild(marketCard);
    });
}

// Create event info display
function createEventInfo() {
    if (!currentEventData) return null;

    const div = document.createElement('div');
    div.className = 'event-info';

    const name = currentEventData.name || currentEventData.title || 'Event';
    const date = currentEventData.startTime || currentEventData.date || currentEventData.start_time;
    const competition = currentEventData.typeName || currentEventData.className || currentEventData.competition || '';
    const category = currentEventData.categoryName || '';

    div.innerHTML = `
        <h3>${name}</h3>
        ${date ? `<p><strong>Date:</strong> ${formatDate(date)}</p>` : ''}
        ${category ? `<p><strong>Sport:</strong> ${category}</p>` : ''}
        ${competition ? `<p><strong>Competition:</strong> ${competition}</p>` : ''}
    `;

    return div;
}

// Parse markets from odds response
function parseMarkets(data) {
    const marketsList = [];

    try {
        // 1. Handle Ladbrokes/OpenBet SSResponse structure (nested children)
        if (data.SSResponse && data.SSResponse.children) {
            // Find the event node within the children array
            const eventNode = data.SSResponse.children.find(child => child.event);
            
            if (eventNode && eventNode.event && eventNode.event.children) {
                // Iterate over the children of the event to find markets
                eventNode.event.children.forEach(child => {
                    if (child.market) {
                        const rawMarket = child.market;
                        
                        // Create a clean market object
                        const market = {
                            id: rawMarket.id,
                            name: rawMarket.name,
                            outcomes: []
                        };

                        // Process outcomes if they exist in the market's children
                        if (rawMarket.children) {
                            rawMarket.children.forEach(outcomeNode => {
                                if (outcomeNode.outcome) {
                                    const rawOutcome = outcomeNode.outcome;
                                    const outcome = {
                                        name: rawOutcome.name,
                                        id: rawOutcome.id,
                                        ...rawOutcome // Keep other properties
                                    };

                                    // Extract price/odds from the nested children array of the outcome
                                    if (rawOutcome.children) {
                                        const priceNode = rawOutcome.children.find(c => c.price);
                                        if (priceNode && priceNode.price) {
                                            // Assign decimal odds to 'odds' property for the display function
                                            // Prefer priceDec, otherwise other formats if needed
                                            outcome.odds = parseFloat(priceNode.price.priceDec);
                                            outcome.price = priceNode.price; // Keep raw price obj just in case
                                        }
                                    }
                                    market.outcomes.push(outcome);
                                }
                            });
                        }
                        marketsList.push(market);
                    }
                });
                
                // Return immediately if we found markets in this structure
                if (marketsList.length > 0) {
                    return marketsList;
                }
            }
        }

        // 2. Fallback: Handle other possible response structures (Standard JSONs)
        if (data.markets && Array.isArray(data.markets)) {
            return data.markets;
        }

        if (data.data && data.data.markets) {
            return Array.isArray(data.data.markets) ? data.data.markets : [data.data.markets];
        }

        // Look for outcome structures at root
        if (data.outcomes || data.selections) {
            return [{
                name: 'Main Market',
                id: 'main',
                outcomes: data.outcomes || data.selections
            }];
        }

        // Try to find markets in nested generic structures
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
        // If string, return as is (parseMarkets logic ensures decimal strings are handled)
        return oddsValue;
    }

    // Try to find odds in nested structures
    if (outcome.price_data) {
        return formatOdds(outcome.price_data);
    }

    if (outcome.odds_data) {
        return formatOdds(outcome.odds_data);
    }

    // Last resort check for price object created in parseMarkets
    if (outcome.price && outcome.price.priceDec) {
        return outcome.price.priceDec;
    }

    return 'N/A';
}

// Initialize
console.log('Betting App Initialized');
console.log('Click "Load Events" to fetch available betting events');
