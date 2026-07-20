const canvas = document.getElementById('skyCanvas');
const ctx = canvas.getContext('2d');
const label = document.getElementById('label');
const rerollBtn = document.getElementById('rerollBtn');
 
const W = canvas.width;
const H = canvas.height;
 
function toRad(deg)
{
    return deg * Math.PI / 180;
}
 
// stereographic projection centred on (ra0, dec0), everything in degrees in, unitless out
function project(ra, dec, ra0, dec0)
{
    const rar = toRad(ra);
    const decr = toRad(dec);
    const ra0r = toRad(ra0);
    const dec0r = toRad(dec0);
 
    const cosc = Math.sin(dec0r) * Math.sin(decr) + Math.cos(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r);
    const k = 2 / (1 + cosc);
 
    // flip x: RA increases eastward, but viewed from inside the sphere looking up, east/west mirror
    const x = -k * Math.cos(decr) * Math.sin(rar - ra0r);
    const y = k * (Math.cos(dec0r) * Math.sin(decr) - Math.sin(dec0r) * Math.cos(decr) * Math.cos(rar - ra0r));
 
    return { x, y };
}
 
// projects every vertex in a constellation's lines, fits the result to the canvas, and draws it
function drawConstellation(cons)
{
    ctx.clearRect(0, 0, W, H);
 
    const [ra0, dec0] = cons.center;
 
    // project everything first so we can fit bounds before drawing
    const projectedLines = cons.lines.map(line => line.map(([ra, dec]) => project(ra, dec, ra0, dec0)));
 
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const line of projectedLines)
    {
        for (const p of line)
        {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
    }
 
    const spanX = maxX - minX || 0.01;
    const spanY = maxY - minY || 0.01;
    const margin = 0.8; // fraction of canvas used, leaves breathing room
    const scale = margin * Math.min(W / spanX, H / spanY);
 
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
 
    function toCanvas(p)
    {
        return {
            x: W / 2 + (p.x - midX) * scale,
            y: H / 2 - (p.y - midY) * scale // flip y, canvas y grows downward
        };
    }
 
    ctx.strokeStyle = '#5a8dee';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#ffffff';
 
    for (const line of projectedLines)
    {
        ctx.beginPath();
        line.forEach((p, i) =>
        {
            const c = toCanvas(p);
            if (i === 0) ctx.moveTo(c.x, c.y);
            else ctx.lineTo(c.x, c.y);
        });
        ctx.stroke();
 
        // star markers at every vertex
        for (const p of line)
        {
            const c = toCanvas(p);
            ctx.beginPath();
            ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
 
    label.textContent = `${cons.name} (${cons.en})`;
}
 
function pickRandomConstellation()
{
    return CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
}
 
let current = CONSTELLATIONS.find(c => c.id === 'Ori') || pickRandomConstellation();
drawConstellation(current);
 
rerollBtn.addEventListener('click', () =>
{
    current = pickRandomConstellation();
    drawConstellation(current);
});






