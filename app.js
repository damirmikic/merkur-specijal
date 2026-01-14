// API Endpoints - Using Netlify Functions to bypass CORS
const EVENTS_API = '/.netlify/functions/get-events';
const ODDS_API_BASE = '/.netlify/functions/get-odds';

// State
let events = [];
let currentEventData = null;
let currentMarkets = [];
let csvExportData = []; // Store data for CSV export

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
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`Failed to fetch events: ${response.status}`);

        const data = await response.json();
        events = parseEvents(data);

        if (events.length === 0) {
            showError('No events found');
            return;
        }

        populateEventDropdown();
        showElement(eventSection);
        
        // Setup CSV Download Button if not already present
        setupCsvButton();

    } catch (error) {
        console.error('Error:', error);
        showError(`Error loading events: ${error.message}`);
    } finally {
        setButtonLoading(false);
    }
}

function parseEvents(data) {
    const eventsList = [];
    try {
        if (data.modules && Array.isArray(data.modules)) {
            data.modules.forEach(module => {
                if (module.data && Array.isArray(module.data)) {
                    eventsList.push(...module.data);
                }
            });
            if (eventsList.length > 0) return eventsList;
        }
        if (data.events) return data.events;
        if (Array.isArray(data)) return data;
    } catch (e) { console.error(e); }
    return eventsList;
}

function populateEventDropdown() {
    eventSelect.innerHTML = '<option value="">-- Choose an event --</option>';
    events.forEach(event => {
        const option = document.createElement('option');
        option.value = event.id || event.eventId;
        option.textContent = event.name || event.eventName;
        option.dataset.event = JSON.stringify(event);
        eventSelect.appendChild(option);
    });
}

function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return dateString; }
}

async function handleEventSelection(e) {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const eventId = selectedOption.value;

    if (!eventId) {
        hideElement(oddsSection);
        return;
    }

    currentEventData = JSON.parse(selectedOption.dataset.event);
    await loadOdds(eventId);
}

async function loadOdds(eventId) {
    showLoading();
    hideElement(errorMessage);
    hideElement(oddsSection);

    try {
        const response = await fetch(`${ODDS_API_BASE}?eventId=${eventId}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`Failed to fetch odds: ${response.status}`);

        const data = await response.json();
        displayOdds(data);
        showElement(oddsSection);

    } catch (error) {
        showError(`Error loading odds: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Setup CSV Download Button in the controls area
function setupCsvButton() {
    let btnContainer = document.getElementById('downloadCsvContainer');
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = 'downloadCsvContainer';
        
        const btn = document.createElement('button');
        btn.id = 'downloadCsvBtn';
        btn.textContent = 'Download CSV (0)';
        btn.onclick = downloadCSV;
        
        btnContainer.appendChild(btn);
        
        // Append next to load button
        const controls = document.querySelector('.controls');
        controls.appendChild(btnContainer);
    }
}

function updateCsvButtonCount() {
    const btn = document.getElementById('downloadCsvBtn');
    if (btn) {
        btn.textContent = `Download CSV (${csvExportData.length})`;
    }
}

function displayOdds(data) {
    oddsContainer.innerHTML = '';
    
    // Clear existing filter
    const existingFilter = document.getElementById('playerFilterContainer');
    if(existingFilter) existingFilter.remove();

    const eventInfo = createEventInfo();
    if (eventInfo) oddsContainer.appendChild(eventInfo);

    try {
        const allMarkets = parseMarkets(data);

        // FILTER: Keep only Player related markets
        currentMarkets = allMarkets.filter(market => {
            const name = (market.name || '').toLowerCase();
            const isPlayerRelated = name.includes('player') || 
                                    name.includes('goalscorer') || 
                                    name.includes('scorer') ||
                                    name.includes('to score');
            
            const isExcluded = name.includes('correct score') || 
                               name.includes('both teams') ||
                               name.includes('team to score') ||
                               name.includes('half time') ||
                               name.includes('handicap');
            
            return isPlayerRelated && !isExcluded;
        });

        if (currentMarkets.length === 0) {
            oddsContainer.innerHTML += '<div class="no-data">No player betting markets available for this event</div>';
            return;
        }

        setupPlayerFilter(currentMarkets);

        // Initial instruction
        const instructDiv = document.createElement('div');
        instructDiv.id = 'selectPlayerMsg';
        instructDiv.className = 'no-data';
        instructDiv.textContent = 'Please select a player from the dropdown above to view odds.';
        oddsContainer.appendChild(instructDiv);

    } catch (error) {
        console.error(error);
        oddsContainer.innerHTML += '<div class="no-data">Error displaying odds data</div>';
    }
}

function setupPlayerFilter(markets) {
    const filterContainer = document.createElement('div');
    filterContainer.id = 'playerFilterContainer';
    filterContainer.style.marginBottom = '15px';
    filterContainer.style.padding = '10px';
    filterContainer.style.backgroundColor = '#fff';
    filterContainer.style.borderRadius = '6px';
    filterContainer.style.border = '1px solid #e2e8f0';
    filterContainer.style.display = 'flex';
    filterContainer.style.alignItems = 'center';

    const label = document.createElement('label');
    label.textContent = 'Select Player: ';
    label.style.marginRight = '10px';
    label.style.fontWeight = 'bold';
    
    const select = document.createElement('select');
    select.id = 'playerSelect';

    const players = new Set();
    const excludeTerms = [
        'over', 'under', 'yes', 'no', 'draw', 'none', 'odd', 'even', 
        'no goalscorer', 'neither', 'home', 'away', 'tie'
    ];

    markets.forEach(market => {
        market.outcomes.forEach(outcome => {
            const name = outcome.name;
            if (name) {
                const nameLower = name.toLowerCase();
                const isGeneric = excludeTerms.some(term => nameLower === term || nameLower.startsWith(term + ' '));
                const isName = name.length > 2 && !/^\d/.test(name);
                
                if (!isGeneric && isName) {
                    players.add(name);
                }
            }
        });
    });

    const sortedPlayers = Array.from(players).sort();

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a Player --';
    select.appendChild(defaultOption);

    sortedPlayers.forEach(player => {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        filterAndRenderMarkets(e.target.value);
    });

    filterContainer.appendChild(label);
    filterContainer.appendChild(select);

    oddsSection.insertBefore(filterContainer, oddsContainer);
}

function filterAndRenderMarkets(playerName) {
    oddsContainer.innerHTML = '';
    const eventInfo = createEventInfo();
    if (eventInfo) oddsContainer.appendChild(eventInfo);

    if (!playerName) {
        const instructDiv = document.createElement('div');
        instructDiv.className = 'no-data';
        instructDiv.textContent = 'Please select a player to view odds.';
        oddsContainer.appendChild(instructDiv);
        return;
    }

    const filteredMarkets = [];
    const playerLower = playerName.toLowerCase();

    currentMarkets.forEach(market => {
        const marketNameLower = market.name.toLowerCase();
        
        // If market name contains player name, include whole market
        if (marketNameLower.includes(playerLower)) {
            filteredMarkets.push(market);
        } else {
            // Else filter outcomes
            const matchingOutcomes = market.outcomes.filter(outcome => {
                return outcome.name.toLowerCase().includes(playerLower);
            });

            if (matchingOutcomes.length > 0) {
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
        noData.textContent = `No odds available for ${playerName}`;
        oddsContainer.appendChild(noData);
    } else {
        renderMarkets(filteredMarkets);
    }
}

function renderMarkets(markets) {
    markets.forEach(market => {
        const marketCard = createMarketCard(market);
        oddsContainer.appendChild(marketCard);
    });
}

function createMarketCard(market) {
    const card = document.createElement('div');
    card.className = 'market-card';

    const header = document.createElement('div');
    header.className = 'market-header';

    const title = document.createElement('span');
    title.className = 'market-title';
    title.textContent = market.name;

    // Add Button (+)
    const addBtn = document.createElement('button');
    addBtn.className = 'add-market-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add to CSV Export';
    addBtn.onclick = (e) => {
        e.stopPropagation();
        addMarketToCSV(market);
    };

    header.appendChild(title);
    header.appendChild(addBtn);
    card.appendChild(header);

    const outcomesGrid = document.createElement('div');
    outcomesGrid.className = 'outcomes-grid';

    market.outcomes.forEach(outcome => {
        const outcomeCard = createOutcomeCard(outcome);
        outcomesGrid.appendChild(outcomeCard);
    });

    card.appendChild(outcomesGrid);
    return card;
}

function createOutcomeCard(outcome) {
    const card = document.createElement('div');
    card.className = 'outcome-card';

    const name = document.createElement('div');
    name.className = 'outcome-name';
    name.textContent = outcome.name;
    name.title = outcome.name; // Tooltip for truncated text

    const odds = document.createElement('div');
    odds.className = 'outcome-odds';
    odds.textContent = formatOdds(outcome);

    card.appendChild(name);
    card.appendChild(odds);
    return card;
}

// Add market to CSV data
function addMarketToCSV(market) {
    const eventName = currentEventData ? (currentEventData.name || currentEventData.eventName) : 'Unknown Event';
    const marketName = market.name;

    market.outcomes.forEach(outcome => {
        const row = {
            Event: eventName,
            Market: marketName,
            Selection: outcome.name,
            Odds: formatOdds(outcome)
        };
        csvExportData.push(row);
    });

    updateCsvButtonCount();
    
    // Optional feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓';
    btn.style.backgroundColor = '#38a169';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 1000);
}

// Generate and Download CSV
function downloadCSV() {
    if (csvExportData.length === 0) {
        alert('No markets added to CSV yet.');
        return;
    }

    const headers = ['Event', 'Market', 'Selection', 'Odds'];
    const csvContent = [
        headers.join(','), // Header row
        ...csvExportData.map(row => {
            // Escape quotes and wrap fields in quotes to handle commas in text
            return headers.map(header => {
                const cell = String(row[header] || '');
                return `"${cell.replace(/"/g, '""')}"`;
            }).join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'betting_markets_export.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Helper Functions
function createEventInfo() {
    if (!currentEventData) return null;
    const div = document.createElement('div');
    div.className = 'event-info';
    div.innerHTML = `<h3>${currentEventData.name}</h3>`;
    return div;
}

function parseMarkets(data) {
    const marketsList = [];
    try {
        if (data.SSResponse && data.SSResponse.children) {
            const eventNode = data.SSResponse.children.find(child => child.event);
            if (eventNode && eventNode.event && eventNode.event.children) {
                eventNode.event.children.forEach(child => {
                    if (child.market) {
                        const m = child.market;
                        const market = { id: m.id, name: m.name, outcomes: [] };
                        if (m.children) {
                            m.children.forEach(o => {
                                if (o.outcome) {
                                    const out = o.outcome;
                                    const outcomeObj = { name: out.name, id: out.id, ...out };
                                    if (out.children) {
                                        const p = out.children.find(c => c.price);
                                        if (p && p.price) {
                                            outcomeObj.odds = parseFloat(p.price.priceDec);
                                            outcomeObj.price = p.price;
                                        }
                                    }
                                    market.outcomes.push(outcomeObj);
                                }
                            });
                        }
                        marketsList.push(market);
                    }
                });
                return marketsList;
            }
        }
        // Fallbacks for other structures...
        if (data.markets) return data.markets;
    } catch (e) { console.error(e); }
    return marketsList;
}

function formatOdds(outcome) {
    const val = outcome.odds || outcome.price?.priceDec || outcome.decimal_odds;
    return val ? Number(val).toFixed(2) : 'N/A';
}

console.log('Betting App Initialized');
