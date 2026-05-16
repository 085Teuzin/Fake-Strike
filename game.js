import * as THREE from 'three';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, onDisconnect, update, get } from "firebase/database";
import { cfg, initSettings } from './config.js';

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

let gameCam = null;
let kills = 0, deaths = 0;
const spawnPoints = [{x:-80,z:-80}, {x:80,z:-80}, {x:-80,z:80}, {x:80,z:80}];

// Inicializa interface global (Lobby e Botões)
const nameInput = document.getElementById('player-name');
const passInput = document.getElementById('player-pass');

if (cfg.name) {
    nameInput.value = cfg.name;
    nameInput.readOnly = true;
    passInput.value = cfg.pass;
}

document.querySelectorAll('.char-btn').forEach(btn => {
    if(btn.dataset.color === cfg.color) btn.classList.add('selected');
    btn.onclick = () => {
        document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        cfg.color = btn.dataset.color;
        localStorage.setItem('fs_color', cfg.color);
    };
});

document.getElementById('config-btn-global').onclick = () => document.getElementById('config-modal').style.display = 'flex';
document.getElementById('close-config').onclick = () => document.getElementById('config-modal').style.display = 'none';
document.getElementById('exit-btn').onclick = () => { if(confirm("Sair?")) window.close(); };

// Conectar e Iniciar
document.getElementById('btn-start').onclick = async () => {
    const user = nameInput.value.trim(), pass = passInput.value.trim();
    if(user.length < 3) return;
    const snap = await get(ref(db, `users/${user}`));
    const data = snap.val();
    
    if(data && data.pass !== pass) {
        document.getElementById('login-error').style.display = 'block';
        return;
    }
    
    if(!data) await set(ref(db, `users/${user}`), { pass, kills: 0, deaths: 0 });
    
    localStorage.setItem('fs_name', user); localStorage.setItem('fs_pass', pass);
    cfg.name = user; kills = data?.kills || 0; deaths = data?.deaths || 0;
    
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'block';
    initGame();
};

function initGame() {
    const playerRef = ref(db, `players/${cfg.name}`);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x87CEEB);
    const camera = new THREE.PerspectiveCamera(cfg.fov, window.innerWidth/window.innerHeight, 0.1, 1000);
    gameCam = camera;
    
    // Inicia o sistema de configurações passando a câmera do jogo
    initSettings(camera);

    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const sp = spawnPoints[Math.floor(Math.random()*4)];
    camera.position.set(sp.x, 1.7, sp.z);

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x444444 })).rotateX(-Math.PI/2));
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({color: 0x222222}));
    gun.position.set(0.3, -0.3, -0.6);
    camera.add(gun); scene.add(camera);

    const otherPlayers = {}, hitboxes = [], sniperSnd = new Audio('sniper.mp3'), hitSnd = new Audio('hit.mp3');

    onValue(ref(db, 'players'), (snap) => {
        const data = snap.val(); if (!data) return;
        if (data[cfg.name]?.isDead) {
            deaths++; update(ref(db, `users/${cfg.name}`), { deaths });
            const r = spawnPoints[Math.floor(Math.random()*4)]; camera.position.set(r.x, 1.7, r.z);
            update(playerRef, { isDead: false, hp: 100 });
        }
        document.getElementById('scoreboard').innerText = `Kills: ${kills} | Deaths: ${deaths}`;
        for (let id in data) {
            if (id === cfg.name) continue;
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
                lookYaw -= (t.clientX - lastX) * (0.005 * cfg.sens);
                lookPitch = Math.max(-1.4, Math.min(1.4, lookPitch - (t.clientY - lastY) * (0.005 * cfg.sens)));
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
                    kills++; update(ref(db, `users/${cfg.name}`), { kills });
                } else update(ref(db, `players/${tId}`), { hp: nHP });
            }
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        camera.rotation.set(lookPitch, lookYaw, 0, 'YXZ');
        const dir = new THREE.Vector3(moveSide, 0, -moveFwd).applyQuaternion(camera.quaternion);
        camera.position.x += dir.x * 0.15; camera.position.z += dir.z * 0.15;
        update(playerRef, { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: camera.rotation.y, color: cfg.color });
        renderer.render(scene, camera);
    }
    animate();
}