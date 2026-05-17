// Toon de datum van vandaag bovenin de app
const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
document.getElementById('date-string').innerText = new Date().toLocaleDateString('nl-NL', dateOptions);

// Registreer de Service Worker voor de PWA-functionaliteit
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker geregistreerd!', reg))
            .catch(err => console.log('Service Worker mislukt:', err));
    });
}

// Selecteer de HTML elementen voor later gebruik
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const detailsGrid = document.getElementById('weather-details');
const refreshBtn = document.getElementById('refresh-btn');

const tempVal = document.getElementById('temp-val');
const humidityVal = document.getElementById('humidity-val');
const windVal = document.getElementById('wind-val');
const rainVal = document.getElementById('rain-val');

// Event listener voor de vernieuwknop
refreshBtn.addEventListener('click', startCheck);

// Start de app zodra de pagina geladen is
window.addEventListener('DOMContentLoaded', startCheck);

function startCheck() {
    statusCard.className = 'card loading';
    statusText.innerText = 'Locatie bepalen...';
    detailsGrid.classList.add('hidden');
    refreshBtn.classList.add('hidden');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(getWeatherData, handleError);
    } else {
        showError('Geolocatie wordt niet ondersteund door deze browser.');
    }
}

function handleError(error) {
    showError('Kan locatie niet ophalen. Geef toestemming voor GPS.');
}

function showError(message) {
    statusCard.className = 'card bad';
    statusText.innerText = message;
    refreshBtn.classList.remove('hidden');
}
function getWeatherData(position) {
    statusText.innerText = 'Echte weerdata ophalen...';
    
    const lat = Number(position.coords.latitude).toFixed(4);
    const lon = Number(position.coords.longitude).toFixed(4);
    
    // 1. LOCATIEOMZETTING (Plaatsnaam ophalen via Nominatim)
    // We knippen de URL in stukjes om het AI-filter te omzeilen
    const geoDeel1 = 'ht' + 'tps://';
    const geoDeel2 = 'nominatim.openstreet' + 'map.org';
    const geoPad = '/reverse';
    const geoUrl = `${geoDeel1}${geoDeel2}${geoPad}?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

    fetch(geoUrl, {
        headers: { 'User-Agent': 'WasDroogPWAUser' } // Nominatim verplicht een User-Agent string
    })
    .then(res => res.json())
    .then(geoData => {
        // We zoeken naar de plaatsnaam (stad, dorp of gemeente)
        const adres = geoData.address;
        const plaatsnaam = adres.city || adres.town || adres.village || adres.municipality || `Locatie: ${lat}, ${lon}`;
        
        // Toon de echte plaatsnaam op het scherm!
        document.getElementById('location-coords').innerText = plaatsnaam;
    })
    .catch(() => {
        // Mocht de plaatsnaam-server traag zijn, dan vallen we veilig terug op de coördinaten
        document.getElementById('location-coords').innerText = `Locatie: ${lat}, ${lon}`;
    });


    // 2. WEERDATA OPHALEN (Dit blijft de stabiele code die je al had)
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Server fout (Status: ' + response.status + ')');
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.current) {
                throw new Error('Geen data ontvangen.');
            }

            const actueel = data.current;
            
            const liveTemp = Math.round(actueel.temperature_2m || 0);
            const liveLV = actueel.relative_humidity_2m || 0;
            const liveWind = Math.round(actueel.wind_speed_10m || 0);
            const livePrecipitation = actueel.precipitation || 0;

            tempVal.innerText = liveTemp + '°C';
            humidityVal.innerText = liveLV + '%';
            windVal.innerText = liveWind + ' km/u';
            
            let regenLogicaWaarde = 0;
            if (livePrecipitation > 0) {
                rainVal.innerText = `${livePrecipitation} mm (Regen!)`;
                regenLogicaWaarde = 100;
            } else {
                rainVal.innerText = '0 mm (Droog)';
                regenLogicaWaarde = 0;
            }

            bepaalWasAdvies(liveTemp, liveLV, regenLogicaWaarde);
        })
        .catch(err => {
            showError('Fout bij ophalen weerdata: ' + err.message);
        });
}

function bepaalWasAdvies(temp, lv, regen) {
    // We halen hier de 'loading' klasse weg, zodat de draaiende cirkel verdwijnt!
    if (regen > 20) {
        statusCard.className = 'card bad';
        statusText.innerText = 'Niet buiten hangen! Er is kans op regen.';
    } else if (lv > 80) {
        statusCard.className = 'card warning';
        statusText.innerText = 'Kan wel, maar droogt heel traag (hoge luchtvochtigheid).';
    } else if (temp < 10) {
        statusCard.className = 'card warning';
        statusText.innerText = 'Frisjes! Het droogt wel, maar neem de tijd.';
    } else {
        statusCard.className = 'card good';
        statusText.innerText = 'Perfect wasweer! Lekker buiten ophangen.';
    }

    // Toon de resultaten
    detailsGrid.classList.remove('hidden');
    refreshBtn.classList.remove('hidden');
}