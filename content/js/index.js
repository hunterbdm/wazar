let loc = {
    lat: 0,
    long: 0,
    heading: 0,
}
let cops = [];
const isDebug = document.location.search.includes('debug')

window.ulfs = (input) => {
    let split = input.split(',').map(x => Number(x.trim()))

    updateLocation({
        coords: {
            latitude: split[0],
            longitude: split[1],
        }
    }, true)
}

function updateLocation(position) {
    if (loc.lat === 0 && loc.long === 0) {
        // loc = {
        //     lat: position.coords.latitude,
        //     long: position.coords.longitude,
        //     heading: 0,
        // }
        loc.lat = position.coords.latitude;
        loc.long = position.coords.longitude;

        pullWazeData();
        setInterval(() => pullWazeData(), 5000)
    } else {
        if (loc.lat === position.coords.latitude && loc.long === position.coords.longitude)
            return

        // loc = {
        //     lat: position.coords.latitude,
        //     long: position.coords.longitude,
        //     heading: calculateAngle(loc.lat, loc.long, position.coords.latitude, position.coords.longitude),
        // }
        loc.lat = position.coords.latitude;
        loc.long = position.coords.longitude;
    }

    updateUI();
}

function updateHeading(e) {
    console.log(e)
    loc.heading = (e['webkitCompassHeading'] || Math.abs(e.alpha - 360)) % 360;
    updateUI()
}

async function pullWazeData() {
    let res = await fetch(`/api?lat=${loc.lat.toFixed(8)}&long=${loc.long.toFixed(8)}`)

    if (res.ok) {
        const resJson = await res.json()
        if (resJson.success && resJson.cops) {
            cops = resJson.cops
            updateUI();
        } else {
            console.log('Error pulling data:', resJson)
        }
    }
}

function updateUI() {
    document.querySelector('#currentLat').innerText = Number(loc.lat).toFixed(8)
    document.querySelector('#currentLong').innerText = Number(loc.long).toFixed(8)
    document.querySelector('#currentHeading').style.transform = `rotateZ(${Number(loc.heading)}deg)`
    if (isDebug)
        document.querySelector('#currentHeading').parentElement.childNodes[0].textContent = `HEADING: ${Math.round(loc.heading)}`

    for (let i = 0; i < cops.length; i++) {
        cops[i].distance = calculateDistance(loc.lat, loc.long, cops[i].location.y, cops[i].location.x)
        cops[i].angleTo = calculateAngle(loc.lat, loc.long, cops[i].location.y, cops[i].location.x)
    }

    cops = cops.sort((a, b) => {
        return a.distance - b.distance
    });

    const currentEntries = document.querySelectorAll('.entry');
    // Remove extra entries
    for (let i = currentEntries.length - 1; i >= cops.length; i--) {
        console.log(`Removing entry #${i}`)
        currentEntries[i].remove()
    }
    // Update data on current entries/make new ones
    for (let i = 0; i < cops.length; i++) {
        if (currentEntries[i])
            updateEntry(currentEntries[i], cops[i])
        else
            createEntry(cops[i])
    }
}

function createEntry(cop) {
    const fixedAngle = Math.round((cop.angleTo - loc.heading) % 360)

    const entry = document.createElement('div');
    entry.classList.add('entry');

    const arrow = document.createElement('i');
    arrow.classList.add('fa', 'fa-arrow-up');
    arrow.style.transform = `rotateZ(${fixedAngle}deg)`;

    const span = document.createElement('span');
    span.classList.add('distance');
    span.innerText = `${cop.distance.toFixed(2)} miles`
    if (cop.street) span.innerText += ` (${cop.street})`

    if (isDebug) {
        span.innerText += ` (${Math.round(cop.angleTo)} / ${fixedAngle})`
    }

    entry.appendChild(arrow);
    entry.appendChild(span);

    document.querySelector('#popo').append(entry)
}

function updateEntry(entry, cop) {
    const fixedAngle = Math.round((cop.angleTo - loc.heading) % 360)
    entry.querySelector('i').style.transform = `rotateZ(${fixedAngle}deg)`;

    const span = entry.querySelector('span')
    span.innerText = `${cop.distance.toFixed(2)} miles`
    if (cop.street) span.innerText += ` (${cop.street})`

    if (isDebug) {
        span.innerText += ` (${Math.round(cop.angleTo)} / ${fixedAngle})`
    }
}

// https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
function calculateDistance(lat1,lon1,lat2,lon2) {
    function deg2rad(deg) {
        return deg * (Math.PI/180)
    }

    //let R = 6371; // Radius of the earth in km
    const R = 3959; // Radius of earth in miles
    const dLat = deg2rad(lat2-lat1);  // deg2rad below
    const dLon = deg2rad(lon2-lon1);
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}
function calculateAngle(lat1,lon1,lat2,lon2) {
    const p1 = {
        x: lat1,
        y: lon1
    };
    const p2 = {
        x: lat2,
        y: lon2
    };

    // angle in radians
    // return Math.atan2(p2.y - p1.y, p2.x - p1.x);

    // angle in degrees
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
}


void function start() {
    try {
        const isIOS =
            navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
            navigator.userAgent.match(/AppleWebKit/);

        // Start by attempting to watch the geolocation position
        if('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(updateLocation, console.log, { 'enableHighAccuracy': true, 'timeout': 1000, 'maximumAge': 10000 });
            setInterval(() => {
                navigator.geolocation.getCurrentPosition(updateLocation, console.log, { 'enableHighAccuracy': true, 'timeout': 1000, 'maximumAge': 10000 });
            }, 1000)
        } else {
            throw "geolocation not supported in this browser"
        }

        // Then device orientation for heading
        if (!isIOS) {
            window.addEventListener("deviceorientationabsolute", updateHeading, true);
        }

        // css flip
        let lightTheme = true;
        window.onclick = function() {
            lightTheme = !lightTheme;

            if (lightTheme) {
                document.body.style.backgroundColor = '#ffffff'
                document.body.style.color = '#000000'
            } else {
                document.body.style.backgroundColor = '#000000'
                document.body.style.color = '#ffffff'
            }

            if (isIOS) {
                DeviceOrientationEvent.requestPermission()
                    .then((res) => {
                        if (res === 'granted')
                            window.addEventListener("deviceorientation", updateHeading, true);
                        else {
                            throw "bad response: " + res
                        }
                    })
                isIOS = false
            }
        }
    } catch(e) {
        document.body.innerHTML = String(e)
    }
}();