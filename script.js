// --- CONFIGURAÇÃO INICIAL E CANVAS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let selectedCharacter = null;
let currentLevel = 1;
let biodiversityIndex = 100;
let gameState = 'START'; // START, PLAYING, WIN, GAMEOVER

// Entrada de Controles
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if(e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => keys[e.code] = false);

// Suporte para Touch (Mobile)
function bindTouch(id, code) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[code] = true; });
    el.addEventListener('touchend', (e) => { e.preventDefault(); keys[code] = false; });
}
bindTouch('btn-up', 'KeyW');
bindTouch('btn-down', 'KeyS');
bindTouch('btn-left', 'KeyA');
bindTouch('btn-right', 'KeyD');
bindTouch('btn-action', 'Space');

// --- SINTETIZADOR DE ÁUDIO WEB (Viola/Efeitos) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const notes = type === 'viola' ? [392, 494, 587] : [type === 'damage' ? 145 : 420];
    const duration = type === 'viola' ? 0.65 : type === 'damage' ? 0.24 : 0.2;

    notes.forEach((frequency, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const voiceStart = now + index * 0.045;
        osc.type = type === 'damage' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(frequency, voiceStart);
        osc.frequency.exponentialRampToValueAtTime(type === 'damage' ? 90 : frequency * 1.35, voiceStart + duration * 0.55);
        gain.gain.setValueAtTime(0.0001, voiceStart);
        gain.gain.linearRampToValueAtTime(type === 'damage' ? 0.075 : 0.09, voiceStart + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, voiceStart + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(voiceStart);
        osc.stop(voiceStart + duration);
    });
}

// --- ENTIDADES DO JOGO ---
const particles = [];
let sceneTime = 0;

function burst(x, y, color, amount = 12) {
    for (let index = 0; index < amount; index++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.7 + Math.random() * 2.4;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.7,
            life: 1,
            size: 2 + Math.random() * 3,
            color
        });
    }
}

class Player {
    constructor() {
        this.x = 50;
        this.y = 250;
        this.size = 20;
        this.speed = 3;
    }

    update() {
        if (keys['KeyW'] || keys['ArrowUp']) if (this.y > 40) this.y -= this.speed;
        if (keys['KeyS'] || keys['ArrowDown']) if (this.y < canvas.height - this.size) this.y += this.speed;
        if (keys['KeyA'] || keys['ArrowLeft']) if (this.x > 0) this.x -= this.speed;
        if (keys['KeyD'] || keys['ArrowRight']) if (this.x < canvas.width - this.size) this.x += this.speed;
    }

    draw() {
        const bob = Math.sin(sceneTime * 5) * 0.8;
        const suit = selectedCharacter === 'iara' ? '#9b593d' : '#427370';
        ctx.save();
        ctx.translate(this.x + 10, this.y + 10 + bob);
        ctx.fillStyle = 'rgba(13, 18, 14, 0.32)';
        ctx.beginPath();
        ctx.ellipse(1, 11, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#34382d';
        ctx.beginPath();
        ctx.roundRect(-8, 2, 5, 11, 2);
        ctx.fill();
        ctx.fillStyle = suit;
        ctx.beginPath();
        ctx.roundRect(-7, 2, 14, 13, 4);
        ctx.fill();
        ctx.fillStyle = selectedCharacter === 'iara' ? '#c4a16d' : '#b39a6c';
        ctx.beginPath();
        ctx.roundRect(-11, 4, 5, 8, 2);
        ctx.fill();
        ctx.fillStyle = '#ded0a8';
        ctx.fillRect(-3, 5, 6, 5);
        ctx.fillStyle = '#e2b38a';
        ctx.beginPath();
        ctx.arc(0, -4, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#352d24';
        ctx.beginPath();
        ctx.ellipse(0, -7, 6, 2.5, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#282a24';
        ctx.beginPath();
        ctx.roundRect(-5, 13, 4, 5, 1.5);
        ctx.roundRect(2, 13, 4, 5, 1.5);
        ctx.fill();
        ctx.strokeStyle = '#342d25';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, -3);
        ctx.lineTo(7, -2);
        ctx.stroke();
        ctx.restore();
    }
}

class AnimalIA {
    constructor(x, y, name, color) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.color = color;
        this.state = 'TRANQUILO'; // FSM: TRANQUILO, ALERTA, FUGA
        this.size = 24;
        this.rescued = false;
    }

    update(player) {
        if (this.rescued) return;

        const dist = Math.hypot(this.x - player.x, this.y - player.y);

        // Máquina de Estados Finitos (FSM)
        if (dist < 80) {
            this.state = 'FUGA';
            // Direção oposta ao jogador
            const angle = Math.atan2(this.y - player.y, this.x - player.x);
            this.x += Math.cos(angle) * 1.5;
            this.y += Math.sin(angle) * 1.5;

            // Limites da tela
            this.x = Math.max(100, Math.min(canvas.width - 50, this.x));
            this.y = Math.max(50, Math.min(canvas.height - 50, this.y));
        } else if (dist < 150) {
            this.state = 'ALERTA';
        } else {
            this.state = 'TRANQUILO';
        }
    }

    draw() {
        const bob = Math.sin(sceneTime * 2.4 + this.x) * 0.65;
        const centerX = this.x + 12;
        const centerY = this.y + 12 + bob;
        const species = this.name.toLocaleLowerCase('pt-BR');
        const feline = species === 'gato-maracajá';
        const eagle = species === 'águia-cinzenta';
        const coat = this.rescued ? '#84985d' : this.color;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.fillStyle = 'rgba(13, 18, 14, 0.3)';
        ctx.beginPath();
        ctx.ellipse(1, 14, eagle ? 13 : 17, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (eagle) {
            const feather = ctx.createLinearGradient(-18, -9, 18, 8);
            feather.addColorStop(0, this.rescued ? '#a8b879' : '#667177');
            feather.addColorStop(1, this.rescued ? '#778b5e' : '#343f45');
            ctx.fillStyle = feather;
            ctx.beginPath();
            ctx.moveTo(-3, 1);
            ctx.quadraticCurveTo(-11, -9, -24, -13);
            ctx.quadraticCurveTo(-20, -4, -11, 4);
            ctx.quadraticCurveTo(-19, 1, -22, 3);
            ctx.quadraticCurveTo(-11, 11, -2, 6);
            ctx.quadraticCurveTo(3, 9, 7, 5);
            ctx.quadraticCurveTo(16, 11, 24, 3);
            ctx.quadraticCurveTo(18, 1, 12, 4);
            ctx.quadraticCurveTo(22, -5, 22, -12);
            ctx.quadraticCurveTo(9, -9, 3, 1);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(223, 219, 194, 0.42)';
            ctx.lineWidth = 0.8;
            for (let featherLine = -1; featherLine <= 1; featherLine++) {
                ctx.beginPath();
                ctx.moveTo(0, 3);
                ctx.lineTo(featherLine * 7, -5);
                ctx.stroke();
            }
            ctx.fillStyle = coat;
            ctx.beginPath();
            ctx.ellipse(1, 1, 4, 10, -0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d6d0b5';
            ctx.beginPath();
            ctx.arc(2, -8, 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#d19b54';
            ctx.beginPath();
            ctx.moveTo(5, -8);
            ctx.lineTo(11, -6);
            ctx.lineTo(5, -4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#20251f';
            ctx.beginPath();
            ctx.arc(3, -9, 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#9b8050';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-2, 8);
            ctx.lineTo(-3, 11);
            ctx.lineTo(0, 11);
            ctx.moveTo(3, 8);
            ctx.lineTo(4, 11);
            ctx.lineTo(6, 10);
            ctx.stroke();
        } else if (feline) {
            const fur = ctx.createLinearGradient(0, -9, 0, 10);
            fur.addColorStop(0, this.rescued ? '#b5b17b' : '#d4a467');
            fur.addColorStop(1, this.rescued ? '#65774c' : '#855e3c');
            ctx.fillStyle = fur;
            ctx.beginPath();
            ctx.ellipse(-1, 2, 15, 8, -0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(12, -5, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#bd9062';
            ctx.beginPath();
            ctx.moveTo(7, -9);
            ctx.lineTo(8, -16);
            ctx.lineTo(13, -10);
            ctx.moveTo(13, -10);
            ctx.lineTo(18, -15);
            ctx.lineTo(18, -7);
            ctx.fill();
            ctx.fillStyle = '#312a22';
            [[-10, 0], [-4, -3], [2, 4], [6, -2], [-9, 5], [1, -5]].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.ellipse(x, y, 1.15, 1.7, 0.4, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.strokeStyle = '#62442f';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-13, 1);
            ctx.quadraticCurveTo(-25, -1, -21, -9);
            ctx.quadraticCurveTo(-18, -14, -15, -11);
            ctx.stroke();
            ctx.fillStyle = '#b7a17b';
            ctx.beginPath();
            ctx.ellipse(15, -3, 2.8, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#28301e';
            ctx.beginPath();
            ctx.ellipse(16, -4, 0.8, 1.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#534637';
            ctx.lineWidth = 1.8;
            [-9, 0, 9].forEach(offset => {
                ctx.beginPath();
                ctx.moveTo(offset, 7);
                ctx.lineTo(offset - 1, 13);
                ctx.stroke();
            });
        } else {
            const fur = ctx.createLinearGradient(0, -8, 0, 11);
            fur.addColorStop(0, this.rescued ? '#a69a80' : '#887360');
            fur.addColorStop(1, this.rescued ? '#716853' : '#4e443a');
            ctx.fillStyle = fur;
            ctx.beginPath();
            ctx.ellipse(-1, 2, 15, 9, -0.06, 0, Math.PI * 2);
            ctx.fill();
            // The tapir's short trunk and pale muzzle distinguish it from other mammals.
            ctx.beginPath();
            ctx.ellipse(12, -3, 6.5, 6, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#b7a894';
            ctx.beginPath();
            ctx.ellipse(18, -1, 6, 3.5, 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = coat;
            ctx.beginPath();
            ctx.ellipse(10, -9, 2.2, 3.6, -0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#211e19';
            ctx.beginPath();
            ctx.arc(14, -5, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#40372e';
            ctx.lineWidth = 2.8;
            [-10, -1, 8].forEach(offset => {
                ctx.beginPath();
                ctx.moveTo(offset, 7);
                ctx.lineTo(offset - 1, 13);
                ctx.stroke();
            });
        }
        ctx.restore();

        if (!this.rescued) {
            ctx.font = '600 11px Trebuchet MS, sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(15, 21, 17, 0.78)';
            ctx.strokeText(this.name, centerX, this.y - 7);
            ctx.fillStyle = '#f3e9cf';
            ctx.fillText(this.name, centerX, this.y - 7);
            if (this.state === 'ALERTA' || this.state === 'FUGA') {
                ctx.fillStyle = this.state === 'FUGA' ? '#e98a6a' : '#e9cf84';
                ctx.beginPath();
                ctx.arc(centerX + 22, centerY - 13, this.state === 'FUGA' ? 4 : 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.font = '600 10px Trebuchet MS, sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(15, 21, 17, 0.78)';
            ctx.strokeText('RESGATADO', centerX, this.y - 7);
            ctx.fillStyle = '#d7e6a8';
            ctx.fillText('RESGATADO', centerX, this.y - 7);
        }
    }
}

class Hazard {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'TRAP', 'TRACTOR', 'HUNTER'
        this.active = true;
        this.size = 26;
    }

    draw() {
        if (!this.active) return;
        const pulse = 0.5 + Math.sin(sceneTime * 4 + this.x) * 0.5;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.type === 'TRAP') {
            ctx.strokeStyle = `rgba(228, 126, 84, ${0.35 + pulse * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(13, 13, 17 + pulse * 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#b9a07a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(13, 15, 10, Math.PI, Math.PI * 2);
            ctx.moveTo(3, 15);
            ctx.lineTo(3, 23);
            ctx.moveTo(23, 15);
            ctx.lineTo(23, 23);
            ctx.stroke();
            ctx.fillStyle = '#dd7654';
            ctx.beginPath();
            ctx.arc(13, 15, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'TRACTOR') {
            ctx.fillStyle = '#d69b4e';
            ctx.fillRect(3, 7, 30, 16);
            ctx.fillStyle = '#e7bc72';
            ctx.fillRect(9, 0, 12, 11);
            ctx.fillStyle = '#344037';
            ctx.fillRect(12, 2, 6, 6);
            ctx.fillStyle = '#252a25';
            ctx.beginPath();
            ctx.arc(10, 24, 6, 0, Math.PI * 2);
            ctx.arc(29, 24, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#bfc0a3';
            ctx.beginPath();
            ctx.arc(10, 24, 2, 0, Math.PI * 2);
            ctx.arc(29, 24, 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'HUNTER') {
            ctx.fillStyle = '#8d8872';
            ctx.beginPath();
            ctx.arc(11, 6, 6, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#4d5746';
            ctx.beginPath();
            ctx.roundRect(3, 11, 17, 18, 5);
            ctx.fill();
            ctx.strokeStyle = '#302f29';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(17, 15);
            ctx.lineTo(29, 10);
            ctx.stroke();
            ctx.fillStyle = `rgba(227, 122, 80, ${0.55 + pulse * 0.35})`;
            ctx.beginPath();
            ctx.arc(12, 11, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// --- ESTADO GLOBAL ---
let player = new Player();
let targetAnimal = null;
let hazards = [];

function initLevel(lvl) {
    player.x = 50;
    player.y = 250;
    hazards = [];

    if (lvl === 1) { // FASE 1: Anta
        document.getElementById('hud-level').innerHTML = '<span>BIOMA</span>Cerradão';
        document.getElementById('hud-obj').innerHTML = '<span>MISSÃO</span>Desative as armadilhas e encontre a anta';
        targetAnimal = new AnimalIA(700, 250, 'Anta', '#6c584c');
        
        hazards.push(new Hazard(200, 150, 'TRAP'));
        hazards.push(new Hazard(350, 300, 'TRAP'));
        hazards.push(new Hazard(500, 200, 'TRAP'));
        hazards.push(new Hazard(580, 380, 'TRAP'));
    } 
    else if (lvl === 2) { // FASE 2: Gato-maracajá
        document.getElementById('hud-level').innerHTML = '<span>BIOMA</span>Mata de galeria';
        document.getElementById('hud-obj').innerHTML = '<span>MISSÃO</span>Reduza o impacto das máquinas e localize o gato-maracajá';
        targetAnimal = new AnimalIA(720, 100, 'Gato-Maracajá', '#f4a261');

        hazards.push(new Hazard(250, 200, 'TRACTOR'));
        hazards.push(new Hazard(450, 120, 'TRACTOR'));
        hazards.push(new Hazard(550, 320, 'TRACTOR'));
    } 
    else if (lvl === 3) { // FASE 3: Águia-cinzenta
        document.getElementById('hud-level').innerHTML = '<span>BIOMA</span>Serra montanhosa';
        document.getElementById('hud-obj').innerHTML = '<span>MISSÃO</span>Afaste os caçadores e ajude a águia-cinzenta';
        targetAnimal = new AnimalIA(700, 380, 'Águia-Cinzenta', '#8d99ae');

        hazards.push(new Hazard(220, 300, 'HUNTER'));
        hazards.push(new Hazard(400, 180, 'HUNTER'));
        hazards.push(new Hazard(600, 280, 'HUNTER'));
    }
}

// --- INTERACTION & SELEÇÃO ---
function selectChar(char) {
    selectedCharacter = char;
    document.getElementById('card-iara').classList.remove('selected');
    document.getElementById('card-yuri').classList.remove('selected');
    document.getElementById(`card-${char}`).classList.add('selected');
    document.getElementById('btn-start').disabled = false;
}

function startGame() {
    document.getElementById('screen-start').classList.add('hidden');
    document.getElementById('hud-char').innerHTML = `<span>CAMPO</span>${selectedCharacter === 'iara' ? 'Iara Krenak' : 'Yuri Guimarães'}`;
    gameState = 'PLAYING';
    biodiversityIndex = 100;
    currentLevel = 1;
    initLevel(currentLevel);
    gameLoop();
}

function handleAction() {
    // Interação com Ameaças (Armadilhas, Máquinas, Caçadores)
    hazards.forEach(h => {
        if (h.active) {
            let dist = Math.hypot(player.x - h.x, player.y - h.y);
            if (dist < 45) {
                h.active = false;
                playSound('action');
                burst(h.x + 13, h.y + 13, '#e6b66b', 14);
                biodiversityIndex = Math.min(100, biodiversityIndex + 5);
            }
        }
    });

    // Interação com Animal (Resgate)
    if (!targetAnimal.rescued) {
        let dist = Math.hypot(player.x - targetAnimal.x, player.y - targetAnimal.y);
        if (dist < 50) {
            targetAnimal.rescued = true;
            playSound('viola');
            burst(targetAnimal.x + 12, targetAnimal.y + 12, '#c6df8b', 28);
            setTimeout(showLevelComplete, 1000);
        }
    }
}

// Disparar ação com a tecla ESPAÇO
window.addEventListener('keydown', e => {
    if (e.code === 'Space' && gameState === 'PLAYING') {
        handleAction();
    }
});

function showLevelComplete() {
    gameState = 'MSG';
    const screenMsg = document.getElementById('screen-msg');
    const title = document.getElementById('msg-title');
    const desc = document.getElementById('msg-desc');
    const btn = document.getElementById('msg-btn');

    screenMsg.classList.remove('hidden');

    if (currentLevel < 3) {
        title.innerText = `Bioma ${currentLevel} protegido`;
        desc.innerText = `A espécie foi resgatada. O índice de biodiversidade ficou em ${Math.round(biodiversityIndex)}%.`;
        btn.innerHTML = 'Explorar próximo bioma <span aria-hidden="true">→</span>';
    } else {
        title.innerText = 'A expedição chegou ao fim';
        desc.innerText = `Três espécies tiveram uma nova chance. Índice final de biodiversidade: ${Math.round(biodiversityIndex)}%.`;
        btn.innerHTML = 'Voltar ao início <span aria-hidden="true">↺</span>';
    }
}

function nextLevel() {
    document.getElementById('screen-msg').classList.add('hidden');
    if (currentLevel < 3) {
        currentLevel++;
        initLevel(currentLevel);
        gameState = 'PLAYING';
        gameLoop();
    } else {
        document.getElementById('screen-start').classList.remove('hidden');
        gameState = 'START';
    }
}

function gameOver() {
    gameState = 'MSG';
    const screenMsg = document.getElementById('screen-msg');
    document.getElementById('msg-title').innerText = 'A área precisa de mais cuidado';
    document.getElementById('msg-desc').innerText = 'O índice chegou a zero. Recomece e tente reduzir as ameaças antes que elas se acumulem.';
    document.getElementById('msg-btn').innerHTML = 'Tentar novamente <span aria-hidden="true">↺</span>';
    screenMsg.classList.remove('hidden');
}

// --- GAME LOOP ---
function update() {
    if (gameState !== 'PLAYING') return;

    sceneTime += 1 / 60;
    player.update();
    targetAnimal.update(player);

    // Danos / Perda de Biodiversidade por perigos ativos não neutralizados
    hazards.forEach(h => {
        if (h.active) {
            let dist = Math.hypot(player.x - h.x, player.y - h.y);
            if (dist < 30) {
                biodiversityIndex -= 0.08; // Perda gradual ao colidir/ficar perto
                if (Math.random() < 0.03) playSound('damage');
            }
        }
    });

    // Atualiza HUD
    document.getElementById('hud-score').innerText = `IB: ${Math.max(0, Math.round(biodiversityIndex))}%`;
    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.035;
        particle.life -= 0.025;
    });
    for (let index = particles.length - 1; index >= 0; index--) {
        if (particles[index].life <= 0) particles.splice(index, 1);
    }

    // Condição de Derrota
    if (biodiversityIndex <= 0) {
        gameOver();
    }
}

function drawBackground() {
    const palettes = [
        { top: '#899477', bottom: '#536246', ridge: '#596447', ground: '#4a5038' },
        { top: '#839b8c', bottom: '#3f6658', ridge: '#466b5c', ground: '#354c40' },
        { top: '#a2a596', bottom: '#657168', ridge: '#71786d', ground: '#515b52' }
    ];
    const palette = palettes[currentLevel - 1];
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, palette.top);
    sky.addColorStop(0.58, palette.bottom);
    sky.addColorStop(1, palette.ground);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sunX = currentLevel === 3 ? 625 : 145;
    const sunY = currentLevel === 3 ? 110 : 125;
    const glow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(236, 203, 135, 0.36)');
    glow.addColorStop(1, 'rgba(236, 203, 135, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);

    const haze = ctx.createLinearGradient(0, 140, 0, 330);
    haze.addColorStop(0, 'rgba(220, 218, 188, 0)');
    haze.addColorStop(1, 'rgba(220, 218, 188, 0.12)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 120, canvas.width, 220);

    // Distant slopes add depth without changing the walkable play area.
    ctx.fillStyle = currentLevel === 3 ? '#69736b' : '#56684e';
    ctx.beginPath();
    ctx.moveTo(0, 305);
    for (let x = 0; x <= canvas.width; x += 40) {
        const ridgeY = currentLevel === 3
            ? 196 + Math.sin(x * 0.018) * 37 + Math.sin(x * 0.043) * 11
            : 246 + Math.sin(x * 0.014) * 25 + Math.sin(x * 0.037) * 8;
        ctx.lineTo(x, ridgeY);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.ridge;
    ctx.beginPath();
    ctx.moveTo(0, 330);
    for (let x = 0; x <= canvas.width; x += 32) {
        const ridgeY = (currentLevel === 3 ? 260 : 306) +
            Math.sin(x * 0.012 + 1.8) * 21 + Math.sin(x * 0.031) * 7;
        ctx.lineTo(x, ridgeY);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    const ground = ctx.createLinearGradient(0, 275, 0, canvas.height);
    ground.addColorStop(0, currentLevel === 2 ? '#536c4c' : currentLevel === 3 ? '#64685b' : '#65704b');
    ground.addColorStop(1, palette.ground);
    ctx.fillStyle = ground;
    ctx.fillRect(0, 300, canvas.width, canvas.height - 300);

    if (currentLevel === 2) {
        const water = ctx.createLinearGradient(0, 300, 0, canvas.height);
        water.addColorStop(0, 'rgba(107, 148, 128, 0.8)');
        water.addColorStop(1, 'rgba(39, 77, 67, 0.94)');
        ctx.fillStyle = water;
        ctx.beginPath();
        ctx.moveTo(0, 365);
        ctx.quadraticCurveTo(210, 324, 390, 365);
        ctx.quadraticCurveTo(615, 414, 800, 348);
        ctx.lineTo(800, 500);
        ctx.lineTo(0, 500);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(204, 219, 191, 0.25)';
        ctx.lineWidth = 1;
        for (let index = 0; index < 10; index++) {
            const x = (index * 103 + 27) % canvas.width;
            const y = 374 + (index * 23) % 105;
            const ripple = Math.sin(sceneTime * 1.6 + index) * 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + 13, y - 2 + ripple, x + 31, y);
            ctx.stroke();
        }
    }

    // Varied tree silhouettes soften the horizon and separate the foliage into layers.
    for (let index = 0; index < 16; index++) {
        const x = (index * 67 + 18) % canvas.width;
        const baseY = 341 + (index * 17 % 54);
        const height = 56 + (index * 29 % 48);
        const width = 5 + index % 5;
        const crownWidth = 23 + index % 15;
        const crownY = baseY - height;
        const bark = currentLevel === 2 ? '#34443a' : currentLevel === 3 ? '#494e47' : '#454435';
        const leafDark = currentLevel === 2 ? '#294438' : currentLevel === 3 ? '#4c5b50' : '#384a32';
        const leafLight = currentLevel === 2 ? '#45634a' : currentLevel === 3 ? '#687265' : '#526044';
        const trunk = ctx.createLinearGradient(x, 0, x + width, 0);
        trunk.addColorStop(0, bark);
        trunk.addColorStop(0.55, currentLevel === 3 ? '#62645a' : '#665b43');
        trunk.addColorStop(1, bark);
        ctx.fillStyle = trunk;
        ctx.beginPath();
        ctx.moveTo(x - width / 2, baseY);
        ctx.lineTo(x - width / 3, crownY + 3);
        ctx.lineTo(x + width / 2, crownY + 3);
        ctx.lineTo(x + width, baseY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = bark;
        ctx.lineWidth = Math.max(2, width * 0.55);
        ctx.beginPath();
        ctx.moveTo(x + width / 2, crownY + 20);
        ctx.lineTo(x - crownWidth * 0.55, crownY - 1);
        ctx.moveTo(x + width / 2, crownY + 16);
        ctx.lineTo(x + crownWidth * 0.6, crownY - 5);
        ctx.stroke();

        const canopy = ctx.createRadialGradient(
            x - crownWidth * 0.2, crownY - 7, 2, x, crownY + 2, crownWidth * 1.1
        );
        canopy.addColorStop(0, leafLight);
        canopy.addColorStop(1, leafDark);
        ctx.fillStyle = canopy;
        ctx.beginPath();
        ctx.ellipse(x, crownY, crownWidth * 0.78, 13 + index % 8, 0, 0, Math.PI * 2);
        ctx.ellipse(x - crownWidth * 0.48, crownY + 5, crownWidth * 0.48, 11, -0.15, 0, Math.PI * 2);
        ctx.ellipse(x + crownWidth * 0.48, crownY + 4, crownWidth * 0.53, 12, 0.12, 0, Math.PI * 2);
        ctx.ellipse(x + crownWidth * 0.08, crownY - 7, crownWidth * 0.48, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(175, 177, 117, 0.18)';
        ctx.beginPath();
        ctx.ellipse(x - crownWidth * 0.2, crownY - 4, crownWidth * 0.25, 3, -0.2, 0, Math.PI * 2);
        ctx.ellipse(x + crownWidth * 0.35, crownY + 1, crownWidth * 0.19, 2.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Uneven patches and grasses break up the flat ground color.
    for (let index = 0; index < 46; index++) {
        const x = (index * 137 + 51) % canvas.width;
        const y = 280 + (index * 71 % 215);
        const width = 18 + index % 25;
        const tint = index % 3 === 0 ? 'rgba(187, 170, 111, 0.09)' : 'rgba(30, 43, 31, 0.10)';
        ctx.beginPath();
        ctx.fillStyle = tint;
        ctx.ellipse(x, y, width, 4 + index % 5, (index % 6) * 0.17, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.lineCap = 'round';
    for (let index = 0; index < 95; index++) {
        const x = (index * 83 + 31) % canvas.width;
        const y = 318 + (index * 47 % 180);
        const height = 4 + index % 8;
        ctx.strokeStyle = index % 3 === 0 ? 'rgba(174, 174, 111, 0.34)' : 'rgba(34, 50, 34, 0.38)';
        ctx.lineWidth = 1 + index % 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - 2, y - height / 2, x + Math.sin(index) * 4, y - height);
        ctx.stroke();
    }

    if (currentLevel === 3) {
        ctx.strokeStyle = 'rgba(213, 210, 188, 0.12)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, 420);
        ctx.quadraticCurveTo(260, 382, 430, 428);
        ctx.quadraticCurveTo(610, 474, 800, 410);
        ctx.stroke();
    }

    const foregroundShade = ctx.createLinearGradient(0, 320, 0, canvas.height);
    foregroundShade.addColorStop(0, 'rgba(22, 29, 22, 0)');
    foregroundShade.addColorStop(1, 'rgba(20, 25, 20, 0.24)');
    ctx.fillStyle = foregroundShade;
    ctx.fillRect(0, 300, canvas.width, canvas.height - 300);

    ctx.fillStyle = 'rgba(226, 212, 167, 0.12)';
    for (let index = 0; index < 35; index++) {
        const x = (index * 137 + 51) % canvas.width;
        const y = 80 + (index * 71 % 380);
        const drift = Math.sin(sceneTime * 0.8 + index) * 1.5;
        ctx.beginPath();
        ctx.ellipse(x + drift, y, 1.5, 1, 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    const shade = ctx.createRadialGradient(400, 250, 180, 400, 250, 540);
    shade.addColorStop(0, 'rgba(13, 19, 15, 0)');
    shade.addColorStop(1, 'rgba(13, 19, 15, 0.35)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function render() {
    drawBackground();

    // Desenhar Ameaças
    hazards.forEach(h => h.draw());

    // Desenhar Animal
    targetAnimal.draw();

    // Desenhar Jogador
    player.draw();

    particles.forEach(particle => {
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function gameLoop() {
    if (gameState === 'PLAYING') {
        update();
        render();
        requestAnimationFrame(gameLoop);
    }
}