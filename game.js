const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreSpan = document.getElementById('score'), comboDiv = document.getElementById('combo');
const fuelBar = document.getElementById('fuel-bar'), worldSpan = document.getElementById('world');
const fuelStatus = document.querySelector('.fuel-status'), startScreen = document.getElementById('start-screen');
const gameoverDiv = document.getElementById('gameover'), scoresDiv = document.getElementById('scores');

let rocket = { x: 0, y: 0, targetY: 0, history: [] };
let asteroids = [], fuelCells = [], stars = [];
let gameRunning = false, score = 0, combo = 1, fuel = 100, world = 0, frame = 0, screenShake = 0, timeScale = 1;
let lastInputY = 0, isMoving = false;

const worlds = [
    { name: 'NEBULA SECTOR', color: '#00f2ff', bg: '#020205' },
    { name: 'COBALT VOID', color: '#4d4dff', bg: '#000010' },
    { name: 'CRIMSON TIDE', color: '#ff0055', bg: '#100005' },
    { name: 'EMERALD EDGE', color: '#00ff88', bg: '#000a05' },
    { name: 'SOLAR FLARE', color: '#ffaa00', bg: '#1a0d00' }
];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(freq, type, dur, slide = 0) {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = type; osc.connect(g); g.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        if (slide) osc.frequency.exponentialRampToValueAtTime(slide, audioCtx.currentTime + dur);
        g.gain.setValueAtTime(0.05, audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + dur);
        osc.start(); osc.stop(audioCtx.currentTime + dur);
    } catch(e) {}
}

function resize() {
    const isP = window.innerHeight > window.innerWidth;
    canvas.width = (isP ? window.innerHeight : window.innerWidth) * 1.1;
    canvas.height = (isP ? window.innerWidth : window.innerHeight);
    rocket.x = canvas.width * 0.05; 
}

function init() {
    resize(); 
    window.addEventListener('resize', resize);
    for (let i = 0; i < 150; i++) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, v: Math.random() * 12 + 4 });

    const getInY = (e) => {
        const isP = window.innerHeight > window.innerWidth;
        const touch = e.touches ? e.touches[0] : e;
        return isP ? touch.clientX : touch.clientY;
    };

    const inputStart = (e) => { 
        if (!gameRunning && gameoverDiv.style.display === 'none') startGame(); 
        isMoving = true; 
        lastInputY = getInY(e); 
    };

    const handleMove = (e) => {
        if(isMoving) {
            const currentY = getInY(e);
            const deltaY = currentY - lastInputY;
            const isP = window.innerHeight > window.innerWidth;
            
            if (isP) { rocket.targetY -= deltaY * 2.0; } 
            else { rocket.targetY += deltaY * 2.0; }
            lastInputY = currentY;
        }
    };

    canvas.addEventListener('mousedown', inputStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', () => isMoving = false);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); inputStart(e); }, {passive: false});
    canvas.addEventListener('touchmove', e => { e.preventDefault(); handleMove(e); }, {passive: false});
    window.addEventListener('touchend', () => isMoving = false);
    loop();
}

function startGame() {
    startScreen.style.display = 'none'; gameoverDiv.style.display = 'none';
    gameRunning = true; score = 0; combo = 1; fuel = 100; world = 0; timeScale = 1;
    asteroids = []; fuelCells = []; rocket.history = [];
    rocket.y = rocket.targetY = canvas.height / 2;
}

function update() {
    if (!gameRunning) return;

  
    let speed = (6 + (score * 0.0008)) * timeScale;
    

    fuel -= 0.1 * timeScale;
    score += (combo > 5 ? 2 : 1) * combo;
    
    rocket.y += (rocket.targetY - rocket.y) * 0.15;
    rocket.targetY = Math.max(60, Math.min(canvas.height-60, rocket.targetY));

    let nextW = Math.min(worlds.length - 1, Math.floor(score / 5000));
    if(nextW > world) { world = nextW; screenShake = 50; playSfx(400, 'sawtooth', 0.4, 100); }

    if(frame % 20 === 0) asteroids.push({ x: canvas.width + 400, y: Math.random()*canvas.height, s: 40+Math.random()*60, hit: false });
    if(frame % 130 === 0) fuelCells.push({ x: canvas.width + 400, y: Math.random()*canvas.height });

    scoreSpan.innerText = Math.floor(score).toString().padStart(5, '0');
    comboDiv.innerText = `x${combo.toFixed(1)}`;
    worldSpan.innerText = worlds[world].name;
    fuelBar.style.width = `${Math.max(0, fuel)}%`;
    fuelBar.style.background = fuel < 30 ? "#ff4444" : worlds[world].color;
    fuelStatus.innerText = fuel < 30 ? "CRITICAL DAMAGE" : "SYSTEM STABLE";

    if(fuel <= 0) endGame();
    frame++;
}

function draw() {
    ctx.fillStyle = worlds[world].bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if(screenShake > 0) { ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake); screenShake *= 0.9; }
    
    let speed = (6 + (score * 0.0008)) * timeScale;

    stars.forEach(s => {
        s.x -= s.v * (speed/3); if(s.x < 0) s.x = canvas.width;
        ctx.fillStyle = worlds[world].color; ctx.globalAlpha = 0.2; ctx.fillRect(s.x, s.y, s.v * 10, 2);
    });

    asteroids = asteroids.filter(a => {
        a.x -= speed; ctx.globalAlpha = 1; ctx.font = `${a.s}px serif`; ctx.fillText("☄️", a.x, a.y);
        let d = Math.hypot(rocket.x - a.x, rocket.y - a.y);
        
      
        if(d < a.s*0.5 && !a.hit) { 
            a.hit=true; 
            fuel -= 35; 
            combo = 1; 
            screenShake = 40; 
            playSfx(60, 'square', 0.3); 
        }
        return a.x > -200;
    });

    fuelCells = fuelCells.filter(f => {
        f.x -= speed; let d = Math.hypot(rocket.x - f.x, rocket.y - f.y);
        if(d < 400) { f.x += (rocket.x - f.x)*0.15; f.y += (rocket.y - f.y)*0.15; }
        ctx.font = `45px serif`; ctx.fillText("⚡", f.x, f.y);
        if(d < 60) { fuel=Math.min(100, fuel+20); combo+=0.5; playSfx(600, 'sine', 0.1, 1200); return false; }
        return f.x > -100;
    });

    rocket.history.unshift({x: rocket.x, y: rocket.y});
    if(rocket.history.length > 15) rocket.history.pop();
    rocket.history.forEach((h, i) => {
        ctx.globalAlpha = (1 - i/15) * 0.2; ctx.font = `50px serif`; ctx.fillText("🚀", h.x - i*6, h.y + 15);
    });

    ctx.save(); ctx.translate(rocket.x, rocket.y);
    ctx.rotate((rocket.targetY - rocket.y) * 0.05);
    ctx.shadowBlur = 25; ctx.shadowColor = worlds[world].color;
    ctx.font = "60px serif"; ctx.fillText("🚀", -30, 20);
    ctx.restore(); ctx.restore();
}

function endGame() {
    gameRunning = false;
    let s = JSON.parse(localStorage.getItem('drift_s') || '[]');
    s.push({ s: Math.floor(score), w: worlds[world].name });
    s.sort((a,b) => b.s - a.s).splice(5);
    localStorage.setItem('drift_s', JSON.stringify(s));
    scoresDiv.innerHTML = s.map(x => `<div>${x.w}: <span style="color:#0fc">${x.s}</span></div>`).join('');
    gameoverDiv.style.display = 'block';
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
init();
window.restart = () => { startGame(); };
