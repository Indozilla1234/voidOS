const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const x11 = require('x11');
const { PNG } = require('pngjs');
const path = require('path');

// --- 1. HARDWARE INITIALIZATION ---
const memory = new Int8Array(3486784401); 
const gpu = new TrinaryGPU();
const cpu = new Void3CPU(memory);

const OPMAP = { 
    "HALT": 0, "ADD": 1, "SUB": 2, "MUL": 3, "SET": 11, "CPY": 12,
    "JMP": 20, "BRN": 21, "BRP": 22, "TRI": 23, "RECT": 30, 
    "WAK": 31, "KEY": 32, "SLP": 45
};

// --- 2. DYNAMIC APP REGISTRY ---
let appRegistry = [];
let vAsmBuffer = [
    "SET 0 0", "SET 1 0", "SET 2 0", "SET 3 0", "SET 4 0", "SET 5 243", "SET 6 243", "RECT" // Clear screen to black
];

/**
 * Processes a single PNG icon and adds its draw commands to the VASM buffer
 */
async function processIcon(pngPath, startX, startY) {
    return new Promise((resolve) => {
        fs.createReadStream(pngPath).pipe(new PNG()).on('parsed', function() {
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    let idx = (this.width * y + x) << 2;
                    // Balanced Ternary Color Mapping (-13 to 13)
                    let r = Math.round((this.data[idx] / 9.807) - 13);
                    let g = Math.round((this.data[idx+1] / 9.807) - 13);
                    let b = Math.round((this.data[idx+2] / 9.807) - 13);
                    
                    if (r !== -13 || g !== -13 || b !== -13) {
                        vAsmBuffer.push(`SET 0 ${r}\nSET 1 ${g}\nSET 2 ${b}\nSET 3 ${startX + x}\nSET 4 ${startY + y}\nSET 5 1\nSET 6 1\nRECT`);
                    }
                }
            }
            resolve();
        });
    });
}

/**
 * Scans /apps/ for subdirectories and builds the launcher UI
 */
async function buildLauncher() {
    process.stdout.write("[BOOT] Scanning for apps...\n");
    const appsDir = './apps';
    if (!fs.existsSync(appsDir)) {
        fs.mkdirSync(appsDir);
        return;
    }

    const folders = fs.readdirSync(appsDir);
    let xPos = 20;
    let yPos = 20;
    const iconSize = 50;
    const padding = 15;

    for (const folder of folders) {
        const appPath = path.join(appsDir, folder);
        const pngPath = path.join(appPath, 'app.png');
        const vasmPath = path.join(appPath, `${folder}.vasm`);

        if (fs.existsSync(pngPath) && fs.existsSync(vasmPath)) {
            process.stdout.write(`[FOUND] ${folder} at grid (${xPos}, ${yPos})\n`);
            
            // Add to Registry for Hitbox detection
            appRegistry.push({
                name: folder,
                vasm: vasmPath,
                x1: xPos, y1: yPos,
                x2: xPos + iconSize, y2: yPos + iconSize
            });

            // Add icon to the VASM draw buffer
            await processIcon(pngPath, xPos, yPos);

            // Advance grid
            xPos += iconSize + padding;
            if (xPos > 180) { // Screen width 243, wrap at 180
                xPos = 20;
                yPos += iconSize + padding;
            }
        }
    }

    // Loop logic: keep the launcher idle after drawing
    vAsmBuffer.push("SET 20 531441\nJMP 20");
    fs.writeFileSync('main.vasm', vAsmBuffer.join('\n'));
}

// --- 3. SYSTEM UTILS ---
function assemble(filename, startAddr) {
    const code = fs.readFileSync(filename, 'utf8');
    let ptr = startAddr;
    const encode = (p, l, val) => {
        let v = BigInt(val);
        for (let i = 0; i < l; i++) {
            let rem = Number(v % 3n);
            if (rem > 1) rem -= 3; if (rem < -1) rem += 3;
            memory[p + i] = rem;
            v = (v - BigInt(rem)) / 3n;
        }
    };

    code.split('\n').forEach(line => {
        let clean = line.split('//')[0].trim();
        if (!clean) return;
        let parts = clean.split(/\s+/);
        let op = OPMAP[parts[0].toUpperCase()];
        if (op === undefined) return;
        encode(ptr, 4, op); 
        encode(ptr + 4, 5, parseInt(parts[1]) || 0); 
        encode(ptr + 9, 6, parseInt(parts[2]) || 0);
        ptr += 15;
    });
}

function launchApp(vasmPath) {
    process.stdout.write(`\n[KERNEL] INTERRUPT: Launching ${vasmPath}...\n`);
    cpu.halted = true;

    // Wipe memory (Balanced 0 = Grey/Middle)
    for (let i = 0; i < 2000000; i++) memory[i] = 0;

    if (fs.existsSync(vasmPath)) {
        assemble(vasmPath, 531441);
        cpu.regs.fill(0n);
        cpu.pc = 531441;
        cpu.halted = false;
        process.stdout.write("[SYSTEM] EXECUTION TRANSFERRED\n");
    }
}

// --- 4. X11 INTERACTION ---
x11.createClient({ display: ':1' }, (err, display) => {
    if (err) return console.error("X11 Connect Error");
    const X = display.client;
    const root = display.screen[0].root;

    const mask = x11.eventMask.ButtonPress | x11.eventMask.PointerMotion;
    X.GrabButton(root, 0, mask, 1, 1, 0, 0, 1, 0x8000); 

    X.on('event', (ev) => {
        if (ev.name === 'ButtonPress') {
            let mx = Math.floor((ev.x / 800) * 243);
            let my = Math.floor((ev.y / 800) * 243);
            
            // Iterate through the registry to check which app was clicked
            for (const app of appRegistry) {
                if (mx >= app.x1 && mx <= app.x2 && my >= app.y1 && my <= app.y2) {
                    launchApp(app.vasm);
                    break;
                }
            }
        }
    });
});

// --- 5. EXECUTION LOOP ---
async function boot() {
    // 1. Scan /apps/ and build the main.vasm UI
    await buildLauncher();
    
    // 2. Load the launcher into memory
    assemble('main.vasm', 531441);
    cpu.pc = 531441;
    process.stdout.write("[SYSTEM] VOID-3 Multi-App Kernel Online.\n");

    function run() {
        if (!cpu.halted) {
            for(let i=0; i<15000; i++) cpu.step();
            gpu.render(cpu.memory);
        }
        setImmediate(run);
    }
    run();
}

boot();