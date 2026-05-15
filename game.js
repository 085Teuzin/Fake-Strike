import * as THREE from 'three';
import { db, ref, set, onValue, onDisconnect, update, get } from './network.js';
import { sensitivity } from './ui.js';

export function initGame(myName, myColor, kills, deaths) {
    const playerRef = ref(db, `players/${myName}`);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({color: 0xEDC9AF})).rotateX(-Math.PI/2));
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), new THREE.MeshStandardMaterial({color: 0x111111}));
    gun.position.set(0.35, -0.35, -0.6); camera.add(gun); scene.add(camera);

    const otherPlayers = {}, hitboxes = [];
    const sniperSound = new Audio('sniper.mp3'), hitSound = new Audio('hit.mp3');

    onValue(ref(db, 'players'), (snapshot) => {
        const data = snapshot.val(); if (!data) return;
        document.getElementById('online-count').innerText = `${Object.keys(data).length} ONLINE`;
        if (data[myName]?.lastKiller && data[myName].lastKiller !== "none") {
            document.getElementById('kill-feed').innerText = `${data[myName].lastKiller.toUpperCase()} ELIMINOU VOCÊ`;
            setTimeout(() => document.getElementById('kill-feed').innerText = "", 2000);
            update(playerRef, { lastKiller: "none" });
        }
        if (data[myName]?.isDead) {
            deaths++; update(ref(db, `users/${myName}`), { deaths: deaths });
            camera.position.set(Math.random()*80-40, 1.7, Math.random()*80-40);
            update(playerRef, { isDead: false, hp: 100 });
        }
        document.getElementById('scoreboard').innerText = `Kills: ${kills} | Deaths: ${deaths}`;
        for (let id in data) {
            if (id === myName) continue;
            const pCol = parseInt(data[id].color || "0x00ff00");
            if (!otherPlayers[id]) {
                const group = new THREE.Group();
                const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.4), new THREE.MeshStandardMaterial({color: pCol}));
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({color: pCol}));
                head.position.y = 1.0; head.userData = { type: 'head', parentId: id }; body.userData = { type: 'body', parentId: id };
                group.add(body, head); scene.add(group); otherPlayers[id] = { group, body, head }; hitboxes.push(body, head);
            }
            const p = otherPlayers[id];
            if(data[id].isDead) { p.group.rotation.x = -Math.PI/2; p.body.material.color.set(0xff0000); p.head.material.color.set(0xff0000); }
            else { p.group.rotation.x = 0; p.group.position.set(data[id].x, data[id].y - 0.5, data[id].z); p.group.rotation.y = data[id].ry; p.body.material.color.set(pCol); p.head.material.color.set(pCol); }
        }
    });

    onValue(ref(db, 'users'), (snap) => {
        const uData = snap.val(); if(!uData) return;
        const arr = Object.keys(uData).map(k => ({name: k, kills: uData[k].kills || 0})).sort((a,b) => b.kills - a.kills);
        document.getElementById('rank-list').innerHTML = arr.slice(0, 3).map((p, i) => `<div>${i+1}. ${p.name.substring(0,10)}: ${p.kills}</div>`).join('');
    });

    onDisconnect(playerRef).remove();

    let canShoot = true, joystickId = null, lookId = null, moveFwd = 0, moveSide = 0, lookYaw = 0, lookPitch = 0, lastX, lastY;
    window.addEventListener('touchstart', (e) => {
        for (let t of e.changedTouches) {
            if (t.target === document.getElementById('shoot-btn')) disparar();
            else if (t.clientX < window.innerWidth/2) joystickId = t.identifier;
            else if (document.getElementById('config-modal').style.display !== 'block') { lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; }
        }
    });

    window.addEventListener('touchmove', (e) => {
        for (let t of e.changedTouches) {
            if (t.identifier === joystickId) {
                const rect = document.getElementById('joystick-area').getBoundingClientRect();
                const dx = t.clientX - (rect.left + 55), dy = t.clientY - (rect.top + 55);
                const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 50); const ang = Math.atan2(dy, dx);
                document.getElementById('joystick-knob').style.transform = `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px)`;
                moveFwd = -Math.sin(ang) * (dist/50); moveSide = Math.cos(ang) * (dist/50);
            }
            if (t.identifier === lookId) {
                const sens = parseFloat(localStorage.getItem('fs_sens')) || 1.0;
                lookYaw -= (t.clientX - lastX) * (0.005 * sens);
                lookPitch = Math.max(-1.4, Math.min(1.4, lookPitch - (t.clientY - lastY) * (0.005 * sens)));
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
        gun.position.z += 0.2; setTimeout(() => gun.position.z -= 0.2, 100);
        const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
        const hits = raycaster.intersectObjects(hitboxes);
        if (hits.length > 0) {
            const hit = hits[0].object; const tId = hit.userData.parentId;
            const snap = await get(ref(db, `players/${tId}`)); const pD = snap.val();
            if(pD && !pD.isDead) {
                hitSound.pause(); hitSound.currentTime = 0; hitSound.play().catch(()=>{});
                document.getElementById('hitmarker').style.display = 'block'; setTimeout(() => document.getElementById('hitmarker').style.display = 'none', 150);
                let nHP = (pD.hp || 100) - (hit.userData.type === 'head' ? 100 : 50);
                if(nHP <= 0) {
                    update(ref(db, `players/${tId}`), { isDead: true, hp: 100, lastKiller: myName });
                    kills++; update(ref(db, `users/${myName}`), { kills: kills });
                    document.getElementById('kill-feed').innerText = `VOCÊ ELIMINOU ${tId.toUpperCase()}`; setTimeout(() => document.getElementById('kill-feed').innerText = "", 2000);
                } else update(ref(db, `players/${tId}`), { hp: nHP });
            }
        }
        const dot = document.getElementById('dot'), circle = document.getElementById('reload-circle'), path = circle.querySelector('circle');
        dot.style.display = 'none'; circle.style.display = 'block'; let prog = 100;
        const inv = setInterval(() => { prog -= 4; path.style.strokeDashoffset = prog; if (prog <= 0) { clearInterval(inv); dot.style.display = 'block'; circle.style.display = 'none'; path.style.strokeDashoffset = 100; canShoot = true; } }, 48);
    }

    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate); const dt = clock.getDelta();
        camera.rotation.order = 'YXZ'; camera.rotation.y = lookYaw; camera.rotation.x = lookPitch;
        const dir = new THREE.Vector3(moveSide, 0, -moveFwd).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), lookYaw));
        camera.position.addScaledVector(dir, 3.5 * dt); camera.position.y = 1.7;
        set(playerRef, { x: camera.position.x, y: camera.position.y, z: camera.position.z, ry: camera.rotation.y, isDead: false, hp: 100, color: myColor, lastKiller: "none" });
        renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
}