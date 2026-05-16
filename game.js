import * as THREE from 'three';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, onDisconnect, update, get } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyBqRAsWfP4w-r82PZOaJcDck7W8Aeph3p8",
    authDomain: "teuzin-games.firebaseapp.com",
    databaseURL: "https://teuzin-games-default-rtdb.firebaseio.com",
    projectId: "teuzin-games",
    storageBucket: "teuzin-games.firebasestorage.app",
    messagingSenderId: "548192563345",
    appId: "1:548192563345:web:e729e39f9f266aa6a68f30"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const state = {
    name: localStorage.getItem('fs_name') || "",
    pass: localStorage.getItem('fs_pass') || "",
    color: localStorage.getItem('fs_color') || "0xff6600",
    sens: parseFloat(localStorage.getItem('fs_sens')) || 1.0,
    fov: parseInt(localStorage.getItem('fs_fov')) || 75,
    crossSize: localStorage.getItem('fs_cross_size') || 4,
    crossColor: localStorage.getItem('fs_cross_color') || "#ffffff",
    btnSize: localStorage.getItem('fs_btn_size') || 100,
    joySize: localStorage.getItem('fs_joy_size') || 120,
    rank: localStorage.getItem('fs_rank_hide') !== "true",
    kills: 0, deaths: 0, inGame: false
};

let gameCam = null;
const spawnPoints = [{x:-80,z:-80}, {x:80,z:-80}, {x:-80,z:80}, {x:80,z:80}];

const uiMap = {
    'fov-slider': { key: 'fs_fov', label: 'fov-label', text: 'FOV: ', cb: v => { state.fov = v; if(gameCam){gameCam.fov=v; gameCam.updateProjectionMatrix();} }},
    'sens-slider': { key: 'fs_sens', label: 'sens-label', text: 'Sensi: ', cb: v => state.sens = v },
    'cross-size-slider': { key: 'fs_cross_size', label: 'cross-size-label', text: 'Tamanho: ', unit: 'px', cb: v => { 
        const d = document.getElementById('dot'); d.style.width = d.style.height = v + 'px'; 
    }},
    'btn-size-slider': { key: 'fs_btn_size', label: 'btn-size-label', text: 'Tiro: ', unit: 'px', cb: v => {
        const b = document.getElementById('shoot-btn'); b.style.width = b.style.height = v + 'px';
    }},
    'joy-size-slider': { key: 'fs_joy_size', label: 'joy-size-label', text: 'Joy: ', unit: 'px', cb: v => {
        const j = document.getElementById('joystick-area'); j.style.width = j.style.height = v + 'px';
    }}
};

function initUI() {
    Object.keys(uiMap).forEach(id => {
        const el = document.getElementById(id);
        const cfg = uiMap[id];
        const val = localStorage.getItem(cfg.key) || el.value;
        
        const update = (v) => {
            localStorage.setItem(cfg.key, v);
            document.getElementById(cfg.label).innerText = `${cfg.text}${v}${cfg.unit || ''}`;
            cfg.cb(v);
        };

        el.value = val;
        update(val);
        el.oninput = (e) => update(e.target.value);
    });

    document.getElementById('cross-color').onchange = (e) => {
        state.crossColor = e.target.value;
        document.getElementById('dot').style.backgroundColor = state.crossColor;
        localStorage.setItem('fs_cross_color', state.crossColor);
    };
}
initUI();

const nameInput = document.getElementById('player-name');
const passInput = document.getElementById('player-pass');
if (state.name) { nameInput.value = state.name; nameInput.readOnly = true; passInput.value = state.pass; }

document.getElementById('btn-start').onclick = async () => {
    const user = nameInput.value.trim(), pass = passInput.value.trim();
    if(user.length < 3) return;
    const snap = await get(ref(db, `users/${user}`));
    const data = snap.val();
    
    if(data && data.pass !== pass) {
        const err = document.getElementById('login-error');
        err.innerText = "Senha Incorreta!"; err.style.display = 'block';
        return;
    }
    
    if(!data) await set(ref(db, `users/${user}`), { pass, kills: 0, deaths: 0 });
    
    localStorage.setItem('fs_name', user); localStorage.setItem('fs_pass', pass);
    state.name = user; state.kills = data?.kills || 0; state.deaths = data?.deaths || 0;
    
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'block';
    state.inGame = true;
    initGame();
};

function initGame() {
    const playerRef = ref(db, `players/${state.name}`);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x87CEEB);
    const camera = new THREE.PerspectiveCamera(state.fov, window.innerWidth/window.innerHeight, 0.1, 1000);
    gameCam = camera;
    
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const sp = spawnPoints[Math.floor(Math.random()*spawnPoints.length)];
    camera.position.set(sp.x, 1.7, sp.z);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x444444 }));
    floor.rotation.x = -Math.PI/2;
    scene.add(floor, new THREE.AmbientLight(0xffffff, 1.2));
    
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({color: 0x222222}));
    gun.position.set(0.3, -0.3, -0.6);
    camera.add(gun); scene.add(camera);

    const otherPlayers = {}, hitboxes = [], sniperSnd = new Audio('sniper.mp3'), hitSnd = new Audio('hit.mp3');

    onValue(ref(db, 'players'), (snap) => {
        const data = snap.val(); if (!data) return;
        
        if (data[state.name]?.isDead) {
            state.deaths++; update(ref(db, `users/${state.name}`), { deaths: state.deaths });
            const r = spawnPoints[Math.floor(Math.random()*4)]; camera.position.set(r.x, 1.7, r.z);
            update(playerRef, { isDead: false, hp: 100 });
        }

        document.getElementById('scoreboard').innerText = `Kills: ${state.kills} | Deaths: ${state.deaths}`;
        
        for (let id in data) {
            if (id === state.name) continue;
            if (!otherPlayers[id]) {
                const p = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({color: parseInt(data[id].color)}));
                p.userData = { id }; scene.add(p); otherPlayers[id] = p; hitboxes.push(p);
            }
            otherPlayers[id].position.set(data[id].x, data[id].y, data[id].z);
            otherPlayers[id].rotation.y = data[id].ry;
        }
    });

    onDisconnect(playerRef).remove();

    let moveFwd = 0, moveSide = 0, lookYaw = 0, lookPitch = 0, joystickId = null, lookId = null, lastX, lastY;

    window.ontouchstart = (e) => {
        if(document.getElementById('config-modal').style.display === 'flex') return;
        for (let t of e.changedTouches) {
            if (t.target.id === 'shoot-btn') disparar();
            else if (t.clientX < window.innerWidth/2) joystickId = t.identifier;
            else { lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; }
        }
    };

    window.ontouchmove = (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === joystickId) {
                const rect = document.getElementById('joystick-area').getBoundingClientRect();
                const dx = t.clientX - (rect.left + rect.width/2), dy = t.clientY - (rect.top + rect.height/2);
                const ang = Math.atan2(dy, dx), dist = Math.min(Math.sqrt(dx*dx+dy*dy), rect.width/2);
                moveFwd = -Math.sin(ang) * (dist/(rect.width/2)); moveSide = Math.cos(ang) * (dist/(rect.width/2));
            }
            if (t.identifier === lookId) {
                lookYaw -= (t.clientX - lastX) * (0.005 * state.sens);
                lookPitch = Math.max(-1.4, Math.min(1.4, lookPitch - (t.clientY - lastY) * (0.005 * state.sens)));
                lastX = t.clientX; lastY = t.clientY;
            }
        }
    };

    async function disparar() {
        sniperSnd.play().catch(()=>{});
        const ray = new THREE.Raycaster(); ray.setFromCamera({x:0, y:0}, camera);
        const hits = ray.intersectObjects(hitboxes);
        if (hits.length > 0) {
            const tId = hits[0].object.userData.id;
            const pD = (await get(ref(db, `players/${tId}`))).val();
            if(pD && !pD.isDead) {
                hitSnd.play().catch(()=>{});
                let nHP = (pD.hp || 100) - 34;
                if(nHP <= 0) {
                    update(ref(db, `players/${tId}`), { isDead: true, hp: 100 });
                    state.kills++; update(ref(db, `users/${state.name}`), { kills: state.kills });
                } else update(ref(db, `players/${tId}`), { hp: nHP });
            }
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        camera.rotation.set(lookPitch, lookYaw, 0, 'YXZ');
        const dir = new THREE.Vector3(moveSide, 0, -moveFwd).applyQuaternion(camera.quaternion);
        camera.position.x += dir.x * 0.15; camera.position.z += dir.z * 0.15;
        update(playerRef, { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: camera.rotation.y, color: state.color });
        renderer.render(scene, camera);
    }
    animate();
}