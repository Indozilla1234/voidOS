const Void3CPU = require('./cpu.js');
const TrinaryGPU = require('./gpu.js');
const fs = require('fs');
const x11 = require('x11');
const { PNG } = require('pngjs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// --- 1. HARDWARE INITIALIZATION ---
// 3^20 elements ~ 3.4GB. Ensure node is run with --max-old-space-size=4096
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
let vAsmBuffer = []; // Start empty to allow the wallpaper to be visible

/**
 * Loads bg.png from /desktop, resizes to 243x243, and writes to VRAM
 */
async function loadWallpaper() {
    const bgPath = './desktop/bg.png';
    if (!fs.existsSync(bgPath)) {
        process.stdout.write("[BOOT] No bg.png found in /desktop. Using black background.\n");
        return;
    }

    try {
        const img = await loadImage(bgPath);
        const bgCanvas = createCanvas(243, 243);
        const bgCtx = bgCanvas.getContext('2d');
        
        bgCtx.drawImage(img, 0, 0, 243, 243);
        const imgData = bgCtx.getImageData(0, 0, 243, 243).data;

        process.stdout.write("[BOOT] Applying Wallpaper to VRAM...\n");

        for (let i = 0; i < 59049; i++) {
            let p = i * 4;
            let addr = i * 9;

            let r = Math.round((imgData[p] / 9.807) - 13);
            let g = Math.round((imgData[p + 1] / 9.807) - 13);
            let b = Math.round((imgData[p + 2] / 9.807) - 13);

            cpu.encode(addr, 3, BigInt(r));
            cpu.encode(addr + 3, 3, BigInt(g));
            cpu.encode(addr + 6, 3, BigInt(b));
        }
    } catch (err) {
        process.stdout.write(`[ERROR] Wallpaper Load Failed: ${err.message}\n`);
    }
}

/**
 * Processes a PNG icon and adds its draw commands to the VASM buffer
 */
async function processIcon(pngPath, startX, startY) {
    return new Promise((resolve) => {
        fs.createReadStream(pngPath).pipe(new PNG()).on('parsed', function() {
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    let idx = (this.width * y + x) << 2;
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
 * Scans ./desktop/apps/ for subdirectories and builds main.vasm
 */
async function buildLauncher() {
    const appsDir = './desktop/apps';
    process.stdout.write(`[BOOT] Scanning ${appsDir} for apps...\n`);
    
    if (!fs.existsSync(appsDir)) {
        process.stdout.write(`[ERROR] ${appsDir} directory not found!\n`);
        return;
    }

    const folders = fs.readdirSync(appsDir);
    let xPos = 20;
    let yPos = 20;
    const iconSize = 50;
    const padding = 15;

    for (const folder of folders) {
        const appPath = path.join(appsDir, folder);
        if (!fs.lstatSync(appPath).isDirectory()) continue;

        const pngPath = path.join(appPath, 'app.png');
        const vasmPath = path.join(appPath, `${folder}.vasm`);

        if (fs.existsSync(pngPath) && fs.existsSync(vasmPath)) {
            process.stdout.write(`[FOUND] ${folder} at grid (${xPos}, ${yPos})\n`);
            
            appRegistry.push({
                name: folder,
                vasm: vasmPath,
                x1: xPos, y1: yPos,
                x2: xPos + iconSize, y2: yPos + iconSize
            });

            await processIcon(pngPath, xPos, yPos);

            xPos += iconSize + padding;
            if (xPos > 180) { 
                xPos = 20;
                yPos += iconSize + padding;
            }
        }
    }

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
    process.stdout.write(`\n[KERNEL] KILLING DESKTOP & LAUNCHING: ${vasmPath}...\n`);
    cpu.halted = true;

    // 1. CLEAR VRAM (Hides wallpaper and icons immediately)
    // 243 * 243 * 9 = 531,441 trits
    for (let i = 0; i < 531441; i++) {
        memory[i] = 0;
    }

    // 2. CLEAR PROGRAM MEMORY (Wipes main.vasm/previous apps)
    for (let i = 531441; i < 2000000; i++) {
        memory[i] = 0;
    }

    if (fs.existsSync(vasmPath)) {
        // 3. ASSEMBLE NEW APP INTO MEMORY
        assemble(vasmPath, 531441);
        
        // 4. RESET CPU STATE
        cpu.regs.fill(0n);
        cpu.pc = 531441;
        cpu.halted = false;
        
        process.stdout.write("[SYSTEM] DESKTOP KILLED. APP OWNERSHIP ESTABLISHED.\n");
    }
}

// --- 4. X11 INTERACTION ---
x11.createClient({ display: ':1' }, (err, display) => {
    if (err) return console.error("X11 Connect Error");
    const X = display.client;
    const root = display.screen[0].root;

    X.on('error', (e) => {
        if (e.error === 10) {
            console.warn("[X11] GrabButton Access Denied. Input may be limited.");
        } else {
            console.error("[X11] Protocol Error:", e);
        }
    });

    const mask = x11.eventMask.ButtonPress | x11.eventMask.PointerMotion;
    X.GrabButton(root, 0, mask, 1, 1, 0, 0, 1, 0x8000);

    X.on('event', (ev) => {
        let mx = Math.floor((ev.x / 800) * 243);
        let my = Math.floor((ev.y / 800) * 243);

        if (ev.name === 'MotionNotify') {
            cpu.updateMouse(mx, my, 0);
        }

        if (ev.name === 'ButtonPress') {
            cpu.updateMouse(mx, my, 1);
            // Hitbox detection for launching apps
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
    process.stdout.write("--- VOID-3 KERNEL BOOTING ---\n");
    
    // 1. Draw Background directly to VRAM
    await loadWallpaper();
    
    // 2. Scan Apps and generate launcher draw calls
    await buildLauncher();
    
    // 3. Assemble launcher and start
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