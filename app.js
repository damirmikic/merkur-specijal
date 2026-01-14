// API Endpoints - Using Netlify Functions to bypass CORS
const EVENTS_API = '/.netlify/functions/get-events';
const ODDS_API_BASE = '/.netlify/functions/get-odds';

// State
let events = [];
let currentEventData = null;
let currentMarkets = [];
let csvExportData = {}; // Store data for CSV export by player
let selectedClub = '';

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
        
        // Setup CSV Controls if not already present
        setupCsvControls();

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
        const date = new Date(dateString);
        return {
            date: date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
            time: date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })
        };
    } catch { return { date: '', time: '' }; }
}

async function handleEventSelection(e) {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const eventId = selectedOption.value;

    if (!eventId) {
        hideElement(oddsSection);
        return;
    }

    currentEventData = JSON.parse(selectedOption.dataset.event);
    
    // Reset state
    csvExportData = {};
    updateCsvButtonCount();
    
    // Update Club Selector options based on event name (assuming "Home v Away" format)
    updateClubSelector();

    await loadOdds(eventId);
}

function updateClubSelector() {
    const clubSelect = document.getElementById('clubSelect');
    if (!clubSelect || !currentEventData) return;
    
    clubSelect.innerHTML = '<option value="">-- Select Club for CSV --</option>';
    
    const eventName = currentEventData.name || currentEventData.eventName || '';
    if (eventName.includes(' v ')) {
        const [home, away] = eventName.split(' v ');
        if (home) clubSelect.add(new Option(home, home));
        if (away) clubSelect.add(new Option(away, away));
    } else {
        // Fallback or just add the event name
         clubSelect.add(new Option(eventName, eventName));
    }
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

// Setup CSV Controls
function setupCsvControls() {
    let controlsContainer = document.getElementById('csvControlsContainer');
    if (!controlsContainer) {
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'csvControlsContainer';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.gap = '10px';
        controlsContainer.style.alignItems = 'center';
        controlsContainer.style.marginLeft = 'auto'; // push to right

        // Club Selector
        const clubSelect = document.createElement('select');
        clubSelect.id = 'clubSelect';
        clubSelect.innerHTML = '<option value="">-- Select Club for CSV --</option>';
        clubSelect.onchange = (e) => { selectedClub = e.target.value; };
        
        // Download Button
        const btn = document.createElement('button');
        btn.id = 'downloadCsvBtn';
        btn.textContent = 'Download CSV (0)';
        btn.style.backgroundColor = '#ed8936'; // orange
        btn.onclick = downloadCSV;
        
        controlsContainer.appendChild(clubSelect);
        controlsContainer.appendChild(btn);
        
        const controls = document.querySelector('.controls');
        controls.appendChild(controlsContainer);
    }
}

function updateCsvButtonCount() {
    const btn = document.getElementById('downloadCsvBtn');
    if (btn) {
        // Count total markets across all players
        let count = 0;
        for (const player in csvExportData) {
            count += csvExportData[player].length;
        }
        btn.textContent = `Download CSV (${count})`;
    }
}

function displayOdds(data) {
    oddsContainer.innerHTML = '';
    
    const existingFilter = document.getElementById('playerFilterContainer');
    if(existingFilter) existingFilter.remove();

    const eventInfo = createEventInfo();
    if (eventInfo) oddsContainer.appendChild(eventInfo);

    try {
        const allMarkets = parseMarkets(data);

        // FILTER: Player related only
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
            oddsContainer.innerHTML += '<div class="no-data">No player betting markets available</div>';
            return;
        }

        setupPlayerFilter(currentMarkets);

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
        
        // Include if Market Name has player name
        if (marketNameLower.includes(playerLower)) {
            filteredMarkets.push(market);
        } else {
            // Or if specific outcome matches player name
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
        renderMarkets(filteredMarkets, playerName);
    }
}

function renderMarkets(markets, playerName) {
    markets.forEach(market => {
        const marketCard = createMarketCard(market, playerName);
        oddsContainer.appendChild(marketCard);
    });
}

function createMarketCard(market, playerName) {
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
    addBtn.title = 'Add this market to CSV Export';
    
    // Store reference to check if already added
    addBtn.onclick = (e) => {
        e.stopPropagation();
        addMarketToCSV(market, playerName, addBtn);
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

    const odds = document.createElement('div');
    odds.className = 'outcome-odds';
    odds.textContent = formatOdds(outcome);

    card.appendChild(name);
    card.appendChild(odds);
    return card;
}

// === CSV LOGIC ===

// Map English API terms to Croatian CSV terms
function getMappedMarketName(apiMarketName, outcomeName) {
    const name = apiMarketName.toLowerCase();
    const outName = outcomeName.toLowerCase();

    // Specific Goalscorer mapping
    if (name.includes('anytime goalscorer')) return 'daje gol';
    if (name.includes('first goalscorer')) return 'prvi daje gol';
    if (name.includes('last goalscorer')) return 'poslednji daje gol';
    if (name.includes('2 or more')) return 'daje 2+ gola';
    if (name.includes('3 or more') || name.includes('hat trick')) return 'daje 3+ gola';

    // Shots
    if (name.includes('shots on target')) {
        if (name.includes('1 or more')) return 'šutevi u okvir gola'; // 1+ implicit if line is 0.5 usually, need careful check
        // Check outcome name or market name for lines
        if (name.includes('2 or more')) return 'šutevi u okvir gola'; 
        return 'šutevi u okvir gola';
    }
    if (name.includes('shots')) return 'ukupno šuteva';

    // Cards
    if (name.includes('to be carded') || name.includes('shown a card')) return 'dobija karton';
    if (name.includes('red card')) return 'dobija crveni karton';
    
    // Assists
    if (name.includes('assist')) return 'asistencija';
    
    // Stats (Fouls, Tackles, Passes usually follow standard structure)
    if (name.includes('foul')) return 'ukupno načinjenih faulova';
    if (name.includes('pass')) return 'ukupno pasova';
    if (name.includes('tackle')) return 'ukupno startova';

    // Default fallback
    return apiMarketName; // Return original if no match
}

function getMappedSelection(marketName, outcomeName) {
    const mName = marketName.toLowerCase();
    const oName = outcomeName.toLowerCase();

    // If it's a simple Yes/No market
    if (oName === 'yes') return 'DA';
    if (oName === 'no') return 'NE';

    // If Over/Under
    if (oName === 'over') return 'Više';
    if (oName === 'under') return 'Manje';

    // Extract lines for stats (e.g. "2 or more")
    const match = mName.match(/(\d+)\s+or\s+more/);
    if (match) {
        return `${match[1]}+`;
    }
    
    // Handle "Exactly X"
    const exactMatch = mName.match(/exactly\s+(\d+)/);
    if (exactMatch) {
        return exactMatch[1];
    }

    // Default for players (if outcome is just the player name, usually the market implies the action 'DA')
    // But check if we need 1+, 2+ etc. 
    // In our specific CSV structure "daje gol" -> "DA". 
    // "ukupno šuteva" -> "1+" or "2+".
    
    // Logic for shots/fouls based on market name parsing
    if (mName.includes('shot') || mName.includes('foul') || mName.includes('tackle')) {
       // Check if line exists in market name like "2 or more shots"
       const line = mName.match(/(\d+)\s+or\s+more/);
       if (line) return `${line[1]}+`;
    }

    return 'DA'; // Default active selection
}

function addMarketToCSV(market, playerName, btnElement) {
    if (!selectedClub) {
        alert('Please select a club from the dropdown first.');
        return;
    }
    
    if (!playerName) {
        alert('No player selected.');
        return;
    }

    // Initialize array for player if not exists
    if (!csvExportData[playerName]) {
        csvExportData[playerName] = [];
    }

    const dateTime = formatDate(currentEventData.startTime || currentEventData.date);

    // Process each outcome (usually just one relevant one for the player filter logic, 
    // or Over/Under/Yes/No pairs)
    // We need to be smart here. The CSV structure is one row per line.
    // If market has "Over" and "Under", we usually want the specific line the user clicked? 
    // But the "+" is on the market card. So we add all visible outcomes on that card.
    
    market.outcomes.forEach(outcome => {
        const mappedMarket = getMappedMarketName(market.name, outcome.name);
        const mappedSelection = getMappedSelection(market.name, outcome.name);
        const odds = formatOdds(outcome);

        const row = {
            date: dateTime.date,
            time: dateTime.time,
            code: '', // Sifra (empty)
            market: mappedMarket,
            selection: mappedSelection,
            odds: odds
        };
        
        // Prevent duplicates
        const exists = csvExportData[playerName].some(r => 
            r.market === row.market && r.selection === row.selection
        );
        
        if (!exists) {
            csvExportData[playerName].push(row);
        }
    });

    updateCsvButtonCount();
    
    // Feedback
    const originalText = btnElement.textContent;
    btnElement.textContent = '✓';
    btnElement.style.backgroundColor = '#38a169';
    setTimeout(() => {
        btnElement.textContent = originalText;
        btnElement.style.backgroundColor = '';
    }, 1000);
}

function downloadCSV() {
    // Check if we have data
    const players = Object.keys(csvExportData);
    if (players.length === 0) {
        alert('No markets added to CSV yet.');
        return;
    }

    // Header
    let csvContent = 'Datum,Vreme,Sifra,Domacin,Gost,1,X,2,GR,U,O,Yes,No\n';
    
    // Match Name Row
    csvContent += `MATCH_NAME:${selectedClub}\n`;

    // Iterate Players
    players.forEach(player => {
        csvContent += `LEAGUE_NAME:${player}\n`;
        
        const rows = csvExportData[player];
        rows.forEach(row => {
            // Build the row string matching: 18.12.2025,20:00,,daje gol,DA,13.00,,,,,,,
            // Structure: Datum, Vreme, Sifra (empty), Market, Selection, Odds, empty...
            const line = `${row.date},${row.time},,${row.market},${row.selection},${row.odds},,,,,,,`;
            csvContent += line + '\n';
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedClub}_odds.csv`);
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
        if (data.markets) return data.markets;
    } catch (e) { console.error(e); }
    return marketsList;
}

function formatOdds(outcome) {
    const val = outcome.odds || outcome.price?.priceDec || outcome.decimal_odds;
    return val ? Number(val).toFixed(2) : 'N/A';
}

console.log('Betting App Initialized');
