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

const nameInput = document.getElementById('player-name');
const passInput = document.getElementById('player-pass');
let savedName = localStorage.getItem('fs_name') || "";
let savedPass = localStorage.getItem('fs_pass') || "";

if (savedName) {
    nameInput.value = savedName;
    nameInput.readOnly = true;
    passInput.value = savedPass;
}

let myName = savedName;
let myColor = localStorage.getItem('fs_color') || "0xff6600";
let sensitivity = parseFloat(localStorage.getItem('fs_sens')) || 1.0;
let fov = parseInt(localStorage.getItem('fs_fov')) || 75;
let rankVisible = localStorage.getItem('fs_rank_hide') !== "true";
let kills = 0, deaths = 0, inGame = false, gameCam = null;

const spawnPoints = [{x:-40,z:-40}, {x:40,z:-40}, {x:-40,z:40}, {x:40,z:40}];
const getRandomSpawn = () => spawnPoints[Math.floor(Math.random()*spawnPoints.length)];

const lobby = document.getElementById('lobby');
const ui = document.getElementById('ui-layer');
const configModal = document.getElementById('config-modal');
const lobbyBtn = document.getElementById('lobby-btn');

document.getElementById('fs-btn-top').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
};

document.getElementById('fov-slider').oninput = (e) => {
    fov = e.target.value;
    document.getElementById('fov-label').innerText = `FOV: ${fov}`;
    if(gameCam) { gameCam.fov = fov; gameCam.updateProjectionMatrix(); }
    localStorage.setItem('fs_fov', fov);
};

document.getElementById('sens-slider').oninput = (e) => {
    sensitivity = e.target.value;
    document.getElementById('sens-label').innerText = `Sensi: ${parseFloat(sensitivity).toFixed(1)}`;
    localStorage.setItem('fs_sens', sensitivity);
};

document.getElementById('cross-color').onchange = (e) => {
    document.getElementById('dot').style.backgroundColor = e.target.value;
    localStorage.setItem('fs_cross_color', e.target.value);
};

document.getElementById('cross-size-slider').oninput = (e) => {
    const s = e.target.value;
    document.getElementById('dot').style.width = s + 'px';
    document.getElementById('dot').style.height = s + 'px';
    document.getElementById('cross-size-label').innerText = `Tamanho: ${s}px`;
    localStorage.setItem('fs_cross_size', s);
};

document.getElementById('btn-size-slider').oninput = (e) => {
    const s = e.target.value;
    const btn = document.getElementById('shoot-btn');
    btn.style.width = s + 'px'; btn.style.height = s + 'px';
    document.getElementById('btn-size-label').innerText = `Botão de Tiro: ${s}px`;
    localStorage.setItem('fs_btn_size', s);
};

document.getElementById('joy-size-slider').oninput = (e) => {
    const s = e.target.value;
    const joy = document.getElementById('joystick-area');
    joy.style.width = s + 'px'; joy.style.height = s + 'px';
    document.getElementById('joy-size-label').innerText = `Joystick: ${s}px`;
    localStorage.setItem('fs_joy_size', s);
};

document.getElementById('config-btn-global').onclick = () => {
    lobbyBtn.style.display = inGame ? "block" : "none";
    configModal.style.display = 'flex';
};
document.getElementById('close-config').onclick = () => configModal.style.display = 'none';

document.getElementById('rank-btn').onclick = () => {
    rankVisible = !rankVisible;
    localStorage.setItem('fs_rank_hide', !rankVisible);
    document.getElementById('rank-btn').innerText = rankVisible ? "RANKING: ON" : "RANKING: OFF";
};
document.getElementById('lobby-btn').onclick = () => location.reload();
document.getElementById('exit-btn').onclick = () => { if(confirm("Sair do jogo?")) window.close(); };

document.querySelectorAll('.char-btn').forEach(btn => {
    if(btn.dataset.color === myColor) btn.classList.add('selected');
    btn.onclick = () => {
        document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        myColor = btn.dataset.color;
        localStorage.setItem('fs_color', myColor);
    };
});

document.getElementById('btn-start').onclick = async () => {
    const user = nameInput.value.trim();
    const pass = passInput.value.trim();
    if(user.length < 3) return;
    const snap = await get(ref(db, `users/${user}`));
    const data = snap.val();
    if(data && data.pass !== pass) {
        document.getElementById('login-error').innerText = "Senha Incorreta!";
        document.getElementById('login-error').style.display = 'block';
        return;
    }
    if(!data) await set(ref(db, `users/${user}`), { pass: pass, kills: 0, deaths: 0 });
    localStorage.setItem('fs_name', user);
    localStorage.setItem('fs_pass', pass);
    myName = user; kills = data?.kills || 0; deaths = data?.deaths || 0;
    lobby.style.display = 'none'; ui.style.display = 'block'; inGame = true;
    initGame();
};

function initGame() {
    const playerRef = ref(db, `players/${myName}`);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    const camera = new THREE.PerspectiveCamera(fov, window.innerWidth/window.innerHeight, 0.1, 1000);
    gameCam = camera;
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const startSpawn = getRandomSpawn();
    camera.position.set(startSpawn.x, 1.7, startSpawn.z);

    const textureLoader = new THREE.TextureLoader();
    const floorTex = textureLoader.load('chao.jpg');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex });
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotateX(-Math.PI/2);
    scene.add(floor);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    
    const gunGroup = new THREE.Group();
    const gBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.4), new THREE.MeshStandardMaterial({color: 0x222222}));
    const gBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), new THREE.MeshStandardMaterial({color: 0x111111}));
    gBarrel.rotation.x = Math.PI/2; gBarrel.position.z = -0.35;
    const gHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), new THREE.MeshStandardMaterial({color: 0x111111}));
    gHandle.position.set(0, -0.15, 0);
    gunGroup.add(gBody, gBarrel, gHandle); gunGroup.position.set(0.35, -0.4, -0.7);
    camera.add(gunGroup); scene.add(camera);

    const otherPlayers = {}, hitboxes = [];
    const sniperSound = new Audio('sniper.mp3'), hitSound = new Audio('hit.mp3');

    onValue(ref(db, 'players'), (snapshot) => {
        const data = snapshot.val(); if (!data) return;
        document.getElementById('online-count').innerText = `${Object.keys(data).length} ONLINE`;
        if (data[myName]?.isDead) {
            deaths++; update(ref(db, `users/${myName}`), { deaths: deaths });
            const resp = getRandomSpawn(); camera.position.set(resp.x, 1.7, resp.z);
            update(playerRef, { isDead: false, hp: 100 });
        }
        document.getElementById('scoreboard').innerText = `Kills: ${kills} | Deaths: ${deaths}`;
        for (let id in data) {
            if (id === myName) continue;
            const pCol = parseInt(data[id].color || "0xff6600");
            if (!otherPlayers[id]) {
                const group = new THREE.Group();
                const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.4), new THREE.MeshStandardMaterial({color: pCol}));
                const bHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({color: pCol}));
                bHead.position.y = 1.0; bHead.userData = { type: 'head', parentId: id }; bBody.userData = { type: 'body', parentId: id };
                group.add(bBody, bHead); scene.add(group); otherPlayers[id] = { group, body: bBody, head: bHead }; hitboxes.push(bBody, bHead);
            }
            const p = otherPlayers[id];
            if(data[id].isDead) { p.group.rotation.x = -Math.PI/2; p.body.material.color.set(0xff0000); p.head.material.color.set(0xff0000); }
            else { p.group.rotation.x = 0; p.group.position.set(data[id].x, data[id].y-0.5, data[id].z); p.group.rotation.y = data[id].ry; p.body.material.color.set(pCol); p.head.material.color.set(pCol); }
        }
    });

    onDisconnect(playerRef).remove();
    let canShoot = true, joystickId = null, lookId = null, moveFwd = 0, moveSide = 0, lookYaw = 0, lookPitch = 0, lastX, lastY;

    window.addEventListener('touchstart', (e) => {
        if(configModal.style.display === 'flex') return;
        for (let t of e.changedTouches) {
            if (t.target === document.getElementById('shoot-btn')) disparar();
            else if (t.clientX < window.innerWidth/2) joystickId = t.identifier;
            else { lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; }
        }
    });

    window.addEventListener('touchmove', (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === joystickId) {
                const rect = document.getElementById('joystick-area').getBoundingClientRect();
                const dx = t.clientX - (rect.left + rect.width/2), dy = t.clientY - (rect.top + rect.height/2);
                const dist = Math.min(Math.sqrt(dx*dx + dy*dy), rect.width/2); const ang = Math.atan2(dy, dx);
                document.getElementById('joystick-knob').style.transform = `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`;
                moveFwd = -Math.sin(ang) * (dist/(rect.width/2)); moveSide = Math.cos(ang) * (dist/(rect.width/2));
            }
            if (t.identifier === lookId) {
                lookYaw -= (t.clientX - lastX) * (0.005 * sensitivity);
                lookPitch = Math.max(-1.4, Math.min(1.4, lookPitch - (t.clientY - lastY) * (0.005 * sensitivity)));
                lastX = t.clientX; lastY = t.clientY;
            }
        }
    });

    window.addEventListener('touchend', (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === joystickId) { joystickId = null; moveFwd = 0; moveSide = 0; document.getElementById('joystick-knob').style.transform = ''; }
            if (t.identifier === lookId) lookId = null;
        }
    });

    async function disparar() {
        if (!canShoot) return; canShoot = false;
        sniperSound.pause(); sniperSound.currentTime = 0; sniperSound.play().catch(()=>{});
        gunGroup.position.z += 0.15; setTimeout(() => gunGroup.position.z -= 0.15, 100);
        const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
        const hits = raycaster.intersectObjects(hitboxes);
        if (hits.length > 0) {
            const hit = hits[0].object; const tId = hit.userData.parentId;
            const snap = await get(ref(db, `players/${tId}`)); const pD = snap.val();
            if(pD && !pD.isDead) {
                hitSound.pause(); hitSound.currentTime = 0; hitSound.play().catch(()=>{});
                document.getElementById('hitmarker').style.display = 'block'; setTimeout(() => document.getElementById('hitmarker').style.display = 'none', 150);
                let nHP = (pD.hp || 100) - (hit.userData.type === 'head' ? 100 : 34);
                if(nHP <= 0) {
                    update(ref(db, `players/${tId}`), { isDead: true, hp: 100, lastKiller: myName });
                    kills++; update(ref(db, `users/${myName}`), { kills: kills });
                } else update(ref(db, `players/${tId}`), { hp: nHP });
            }
        }
        setTimeout(() => { canShoot = true; }, 800);
    }

    function animate() {
        requestAnimationFrame(animate);
        camera.rotation.order = 'YXZ'; camera.rotation.y = lookYaw; camera.rotation.x = lookPitch;
        const dir = new THREE.Vector3(moveSide, 0, -moveFwd).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), lookYaw));
        camera.position.addScaledVector(dir, 0.12); camera.position.y = 1.7;
        set(playerRef, { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: camera.rotation.y, isDead: false, hp: 100, color: myColor });
        renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
}