const canvas = document.getElementById('skyCanvas');
const ctx = canvas.getContext('2d');
const label = document.getElementById('label');
const rerollBtn = document.getElementById('rerollBtn');

const W = canvas.width;
const H = canvas.height;

// how wide the camera fov is, w how far out we bother pulling neighbours from
const FOV_RADIUS_DEG = 40;
const INCLUDE_RADIUS_DEG = 55;

function toRad(deg)
{
    return deg * Math.PI / 180;
}

// angular distance between two points on the sky, in degrees
function angularSep(ra, dec, ra0, dec0)
{
    const rar = toRad(ra);
    const decr = toRad(dec);
    const ra0r = toRad(ra0);
    const dec0r = toRad(dec0);

    const cosc = Math.sin(dec0r) * Math.sin(decr) + Math.cos(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r);
    return Math.acos(Math.max(-1, Math.min(1, cosc))) * 180 / Math.PI;
}

// stereographic projection centred on (ra0, dec0), degrees in, unitless out
function project(ra, dec, ra0, dec0)
{
    const rar = toRad(ra);
    const decr = toRad(dec);
    const ra0r = toRad(ra0);
    const dec0r = toRad(dec0);

    const cosc = Math.sin(dec0r) * Math.sin(decr) + Math.cos(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r);
    const k = 2 / (1 + cosc);

    // flip x cus ra goes east but we're looking up from inside the sphere so east/west mirror
    const x = -k * Math.cos(decr) * Math.sin(rar - ra0r);
    const y = k * (Math.cos(dec0r) * Math.sin(decr) - Math.sin(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r));

    return { x, y };
}

// projected radius for a given angle from centre, keeps the camera zoom fixed
function rhoForAngle(deg)
{
    return 2 * Math.tan(toRad(deg) / 2);
}

// grabs every constellation w at least one point inside INCLUDE_RADIUS_DEG of the target
function findNearby(target)
{
    const [ra0, dec0] = target.center;
    const nearby = [];

    for (const cons of CONSTELLATIONS)
    {
        if (cons.id === target.id) continue;

        const isNear = cons.lines.some(line => line.some(([ra, dec]) => angularSep(ra, dec, ra0, dec0) <= INCLUDE_RADIUS_DEG));
        if (isNear) nearby.push(cons);
    }

    return nearby;
}

function drawLines(cons, ra0, dec0, scale, color, lineWidth)
{
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;

    function toCanvas(ra, dec)
    {
        const p = project(ra, dec, ra0, dec0);
        return {
            x: W / 2 + p.x * scale,
            y: H / 2 - p.y * scale // flip y cus canvas y grows downward
        };
    }

    for (const line of cons.lines)
    {
        ctx.beginPath();
        line.forEach(([ra, dec], i) =>
        {
            const c = toCanvas(ra, dec);
            if (i === 0) ctx.moveTo(c.x, c.y);
            else ctx.lineTo(c.x, c.y);
        });
        ctx.stroke();

        for (const [ra, dec] of line)
        {
            const c = toCanvas(ra, dec);
            ctx.beginPath();
            ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// centres camera on target at fixed fov, target's highlighted w neighbours dimmed
function drawScene(target)
{
    ctx.clearRect(0, 0, W, H);

    const [ra0, dec0] = target.center;
    const rhoMax = rhoForAngle(FOV_RADIUS_DEG);
    const margin = 0.9;
    const scale = (margin * Math.min(W, H) / 2) / rhoMax;

    const neighbours = findNearby(target);

    for (const cons of neighbours)
    {
        drawLines(cons, ra0, dec0, scale, '#2e3d5c', 1);
    }

    drawLines(target, ra0, dec0, scale, '#5a8dee', 1.8);

    label.textContent = `${target.name} (${target.en}) — ${neighbours.length} neighbours in frame`;
}

function pickRandomConstellation()
{
    return CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
}

let current = CONSTELLATIONS.find(c => c.id === 'Ori') || pickRandomConstellation();
drawScene(current);

rerollBtn.addEventListener('click', () =>
{
    current = pickRandomConstellation();
    drawScene(current);
});




























