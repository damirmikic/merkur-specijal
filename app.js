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

    let filteredMarkets = [];
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
                // Clone the market and only include matching outcomes
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
        // Group and render markets by type
        renderGroupedMarkets(filteredMarkets, playerName);
    }
}

// Function to classify markets into groups
function getMarketGroup(marketName) {
    const name = marketName.toLowerCase();
    
    if (name.includes('shot') && name.includes('target')) return 'Shots on Target';
    if (name.includes('shot')) return 'Total Shots';
    if (name.includes('assist')) return 'Assists';
    // Handle "Player to Score and Team Win" separately or under Goals
    if (name.includes('score') && name.includes('win') && name.includes('team')) return 'Score & Win';
    if (name.includes('goalscorer') || name.includes('score')) return 'Goalscorers';
    if (name.includes('card') || name.includes('shown')) return 'Cards';
    if (name.includes('offside')) return 'Offsides';
    if (name.includes('foul')) return 'Fouls';
    if (name.includes('tackle')) return 'Tackles';
    if (name.includes('pass')) return 'Passes';
    
    return 'Other';
}

function renderGroupedMarkets(markets, playerName) {
    // Group markets
    const groups = {};
    
    markets.forEach(market => {
        const groupName = getMarketGroup(market.name);
        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(market);
    });

    // Define sort order for groups
    const sortOrder = [
        'Goalscorers', 
        'Score & Win', 
        'Shots on Target', 
        'Total Shots', 
        'Assists', 
        'Cards', 
        'Fouls', 
        'Tackles', 
        'Offsides', 
        'Passes', 
        'Other'
    ];

    // Render groups in order
    sortOrder.forEach(groupName => {
        if (groups[groupName] && groups[groupName].length > 0) {
            // Group Header
            const groupHeader = document.createElement('h4');
            groupHeader.className = 'market-group-title';
            groupHeader.textContent = groupName;
            groupHeader.style.marginTop = '20px';
            groupHeader.style.marginBottom = '10px';
            groupHeader.style.color = '#2d3748';
            groupHeader.style.borderBottom = '2px solid #e2e8f0';
            groupHeader.style.paddingBottom = '5px';
            oddsContainer.appendChild(groupHeader);

            // Render markets in this group
            groups[groupName].forEach(market => {
                const marketCard = createMarketCard(market, playerName);
                oddsContainer.appendChild(marketCard);
            });
        }
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
    
    // GOALS
    if (name.includes('hat trick')) return 'Postize 3 gola';
    if (name.includes('score exactly 1')) return 'Daje tacno 1 gol';
    if (name.includes('score exactly 2')) return 'Daje tacno 2 gola';
    if (name.includes('score exactly 3')) return 'Daje tacno 3 gola'; // same as hat trick usually
    if (name.includes('anytime goalscorer')) return 'Daje gol';
    if (name.includes('score 2 or more')) return 'Daje 2+ golova';
    if (name.includes('score 3 or more')) return 'Daje 3+ golova';
    if (name.includes('score in both halves')) return 'Daje gol u oba pol.';
    if (name.includes('score') && name.includes('team') && name.includes('win')) return 'Daje gol i pobedjuje';

    // SHOTS ON TARGET
    if (name.includes('shots on target')) {
         // Check for specific line in the name
         const match = name.match(/(\d+)/);
         if (match) {
             const line = match[1];
             return `Uk. suteva u okvir`; // CSV expects "Uk. suteva u okvir" in market col, line in selection
         }
         return 'Uk. suteva u okvir';
    }
    
    // TOTAL SHOTS
    if (name.includes('shots') && !name.includes('target')) {
         return 'Uk. suteva';
    }

    // ASSISTS
    if (name.includes('assist')) return 'Asistencija';
    
    // CARDS
    if (name.includes('to be carded') || name.includes('shown a card')) return 'Dobija karton';
    if (name.includes('red card')) return 'Dobija crveni karton';
    
    // FOULS
    if (name.includes('foul')) return 'Uk. faulova';
    
    // TACKLES
    if (name.includes('tackle')) return 'Uk. startova';
    
    // OFFSIDES
    if (name.includes('offside')) return 'Uk. ofsajda';

    // Default fallback
    return apiMarketName; 
}

function getMappedSelection(marketName, outcomeName) {
    const mName = marketName.toLowerCase();
    const oName = outcomeName.toLowerCase();

    // Standard mappings
    if (oName === 'yes') return 'DA';
    if (oName === 'no') return 'NE';
    if (oName === 'over') return 'Više';
    if (oName === 'under') return 'Manje';

    // Handle "Exactly X" -> DA
    if (mName.includes('exactly')) return 'DA';
    
    // Handle "X or more" -> extract X and format as "X+"
    const moreMatch = mName.match(/(\d+)\s+or\s+more/);
    if (moreMatch) {
        return `${moreMatch[1]}+`;
    }
    
    // Handle "Hat trick" -> DA
    if (mName.includes('hat trick')) return 'DA';

    // Handle specific text mappings asked
    // "Postize 3 gola" -> selection is "Postize 3 gola" based on user example, but usually selection is DA/NE.
    // User wrote: "To Score a Hat-trick?- Postize 3 gola - Postize 3 gola, DA"
    // Wait, the prompt says "Postize 3 gola - Postize 3 gola, DA". This implies MarketName is "Postize 3 gola" and Selection is "DA"? 
    // Or MarketName is "Postize 3 gola" and selection is "Postize 3 gola"?
    // Looking at other examples: "Anytime Goalscorer - Daje Gol- Daje gol, DA". 
    // Format: "English Market - Translated Market - CSV Market Name, CSV Selection".
    // So for hattrick: CSV Market="Postize 3 gola", CSV Selection="DA".
    
    // Goals
    if (mName.includes('anytime goalscorer')) return 'DA';
    if (mName.includes('score')) return 'DA'; // Covers "Score exactly", "Score 2+", "Score in both halves", "Score and win"

    // Assists
    if (mName.includes('assist')) return 'DA';

    // Cards
    if (mName.includes('card')) return 'DA';

    // Stats (Shots, Fouls, Tackles, Offsides) - Need to extract line from market name usually
    // e.g. "Player to have 1 or more shots" -> Market "Uk. suteva", Selection "1+"
    // The "or more" regex above handles this returns "1+".
    
    return 'DA'; // Default fallback
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

    // Filter relevant outcomes
    const relevantOutcomes = market.outcomes.filter(o => 
        o.name.toLowerCase().includes(playerName.toLowerCase()) || 
        ['yes', 'no', 'over', 'under'].includes(o.name.toLowerCase())
    );

    relevantOutcomes.forEach(outcome => {
        const mappedMarket = getMappedMarketName(market.name, outcome.name);
        const mappedSelection = getMappedSelection(market.name, outcome.name);
        const odds = formatOdds(outcome);

        const row = {
            date: dateTime.date,
            time: dateTime.time,
            code: '', 
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
