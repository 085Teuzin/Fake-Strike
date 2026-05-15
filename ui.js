import { realizarLogin, monitorarRanking } from './network.js';
import { initGame } from './game.js';

export let sensitivity = parseFloat(localStorage.getItem('fs_sens')) || 1.0;
let rankVisible = localStorage.getItem('fs_rank_hide') !== "true";
let myColor = localStorage.getItem('fs_color') || "0x00ff00";

const lobby = document.getElementById('lobby');
const uiLayer = document.getElementById('ui-layer');
const configModal = document.getElementById('config-modal');
const rankingBox = document.getElementById('ranking-box');

rankingBox.style.display = rankVisible ? 'block' : 'none';

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
    const user = document.getElementById('player-name').value.trim().toLowerCase();
    const pass = document.getElementById('player-pass').value.trim();
    if(user.length < 3 || pass.length < 3) return;

    import('./network.js').then(async (net) => {
        const snapshot = await net.get(net.ref(net.db, `users/${user}`));
        const data = snapshot.val();
        if(data && data.pass !== pass) {
            document.getElementById('login-error').innerText = "Senha Incorreta!";
            document.getElementById('login-error').style.display = 'block';
            return;
        }
        if(!data) await net.set(net.ref(net.db, `users/${user}`), { pass: pass, kills: 0, deaths: 0 });
        
        localStorage.setItem('fs_name', user);
        localStorage.setItem('fs_pass', pass);
        lobby.style.display = 'none';
        uiLayer.style.display = 'block';
        initGame(user, myColor, data ? data.kills : 0, data ? data.deaths : 0);
    });
};

document.getElementById('config-btn').onclick = () => configModal.style.display = 'block';
document.getElementById('btn-close-config').onclick = () => configModal.style.display = 'none';

const sSlider = document.getElementById('sens-slider');
const sLabel = document.getElementById('sens-label');
sSlider.value = sensitivity;
sLabel.innerText = `Sensibilidade: ${sensitivity.toFixed(1)}`;

sSlider.oninput = () => {
    sensitivity = parseFloat(sSlider.value);
    sLabel.innerText = `Sensibilidade: ${sensitivity.toFixed(1)}`;
    localStorage.setItem('fs_sens', sensitivity);
};

document.getElementById('fullscreen-btn').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
};

document.getElementById('toggle-rank-btn').onclick = () => {
    rankVisible = !rankVisible;
    localStorage.setItem('fs_rank_hide', !rankVisible);
    rankingBox.style.display = rankVisible ? 'block' : 'none';
    document.getElementById('toggle-rank-btn').innerText = rankVisible ? "Ocultar Ranking" : "Mostrar Ranking";
};