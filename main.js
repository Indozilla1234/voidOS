const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const path = require('path');
const x11 = require('x11');
const { PNG } = require('pngjs');

// --- 1. HARDWARE ---
const memory = new Int8Array(3486784401);
for (let i = 0; i < memory.length; i++) memory[i] = 0; 
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

const OPMAP = { 
    "HALT": 0, "ADD": 1, "SUB": 2, "MUL": 3, "SET": 11, "CPY": 12,
    "JMP": 20, "BRN": 21, "BRP": 22, "TRI": 23, "RECT": 30, 
    "WAK": 31, "KEY": 32, "SLP": 45
};

// --- 2. RECURSIVE SEARCHER ---
function findIconPath(dir, targetFile) {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = findIconPath(fullPath, targetFile);
                if (found) return found;
            } else if (file.toLowerCase() === targetFile.toLowerCase()) return fullPath;
        }
    } catch (e) { return null; }
    return null;
}

// --- 3. THE VASM COMPILER ---
function compileFullOS() {
    const vasmPath = path.join(__dirname, 'main.vasm');
    let iconPath = findIconPath(__dirname, 'app.png');
    
    let vasmContent = `// Compiled from Trit-C\n`;
    vasmContent += `SET 0 0\nSET 1 0\nSET 2 0\nSET 3 0\nSET 4 0\nSET 5 243\nSET 6 243\nRECT\n`;

    if (iconPath) {
        const png = PNG.sync.read(fs.readFileSync(iconPath));
        for (let y = 0; y < png.height; y++) {
            for (let x = 0; x < png.width; x++) {
                const idx = (png.width * y + x) << 2;
                if (png.data[idx+3] < 128) continue;
                const r = png.data[idx] > 160 ? 13 : (png.data[idx] < 90 ? -13 : 0);
                const g = png.data[idx+1] > 160 ? 13 : (png.data[idx+1] < 90 ? -13 : 0);
                const b = png.data[idx+2] > 160 ? 13 : (png.data[idx+2] < 90 ? -13 : 0);
                vasmContent += `SET 0 ${r}\nSET 1 ${g}\nSET 2 ${b}\nSET 3 ${30 + x}\nSET 4 ${40 + y}\nSET 5 1\nSET 6 1\nRECT\n`;
            }
        }
    }

    const lines = vasmContent.split('\n').filter(l => l.trim() && !l.startsWith('//'));
    const listenerAddr = 531441 + (lines.length * 15);
    const paintAddr = listenerAddr + 45; 

    vasmContent += `// LISTENER\n`;
    vasmContent += `WAK 10 2\n`; // Poll Click
    vasmContent += `TRI 10 ${paintAddr}\n`; // If clicked, go to Paint
    vasmContent += `JMP ${listenerAddr}\n`; 

    vasmContent += `// PAINT START\n`;
    vasmContent += `SET 10 0\n`; // RESET CLICK STATUS IMMEDIATELY
    vasmContent += `WAK 3 0\nWAK 4 0\n`; // Track mouse
    vasmContent += `SET 0 13\nSET 1 13\nSET 2 13\n`; 
    vasmContent += `SET 5 3\nSET 6 3\nRECT\n`; 
    vasmContent += `JMP ${paintAddr + 15}\n`; // Loop Paint, skipping the Click Reset

    fs.writeFileSync(vasmPath, vasmContent);
    console.log(`VOID-3: Logo Ready. Listener at ${listenerAddr}.`);
}

// --- 4. ASSEMBLER & RUNTIME ---
function encodeBalanced(ptr, length, value) {
    let temp = BigInt(value);
    for (let i = 0; i < length; i++) {
        let trit = Number(((temp + 1n) % 3n) - 1n);
        memory[ptr + i] = trit;
        temp = (temp - BigInt(trit)) / 3n;
    }
    return ptr + length;
}

function assemble(filename, startAddr) {
    const lines = fs.readFileSync(path.join(__dirname, filename), 'utf8').split('\n');
    let ptr = startAddr; 
    lines.forEach(line => {
        const clean = line.split('//')[0].trim();
        if (!clean) return;
        const parts = clean.split(/\s+/);
        let op = OPMAP[parts[0].toUpperCase()];
        if (op === undefined) return;
        ptr = encodeBalanced(ptr, 4, op);   
        ptr = encodeBalanced(ptr, 5, parseInt(parts[1]) || 0);   
        ptr = encodeBalanced(ptr, 6, parseInt(parts[2]) || 0);   
    });
}

compileFullOS();
assemble('main.vasm', 531441); 
cpu.pc = 531441;

setInterval(() => {
    // Increased cycle count to ensure we get through drawing and hitting the listener
    for(let i=0; i<600000 && !cpu.halted; i++) {
        cpu.step(); 
    }
    gpu.render(cpu.memory);
}, 50);

// --- 5. X11 INPUT (STICKY CLICKS) ---
x11.createClient({ display: ':1' }, (err, display) => {
    if (err) return;
    const X = display.client;
    const root = display.screen[0].root;
    X.on('error', () => {}); 
    X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.ButtonPress | x11.eventMask.ButtonRelease | x11.eventMask.PointerMotion });
    X.on('event', (ev) => {
        let mx = Math.max(0, Math.min(242, Math.floor((ev.x / 800) * 243)));
        let my = Math.max(0, Math.min(242, Math.floor((ev.y / 600) * 243)));
        
        if (ev.type === 4) { // Button Press
            console.log(`VOID-3: Click Detected at ${mx}, ${my}`);
            cpu.updateMouse(mx, my, 1);
        }
        if (ev.type === 5) { // Button Release
            cpu.updateMouse(mx, my, 0);
        }
        if (ev.type === 6) { // Motion
            cpu.updateMouse(mx, my, cpu.mouseClicked);
        }
    });
});