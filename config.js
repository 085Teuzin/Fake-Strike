export const cfg = {
    name: localStorage.getItem('fs_name') || "",
    pass: localStorage.getItem('fs_pass') || "",
    color: localStorage.getItem('fs_color') || "0xff6600",
    sens: parseFloat(localStorage.getItem('fs_sens')) || 1.0,
    fov: parseInt(localStorage.getItem('fs_fov')) || 75,
    crossSize: localStorage.getItem('fs_cross_size') || 4,
    crossColor: localStorage.getItem('fs_cross_color') || "#ffffff",
    btnSize: localStorage.getItem('fs_btn_size') || 100,
    joySize: localStorage.getItem('fs_joy_size') || 120,
    rank: localStorage.getItem('fs_rank_hide') !== "true"
};

const uiMap = {
    'fov-slider': { key: 'fs_fov', label: 'fov-label', text: 'FOV: ', cb: (v, cam) => { cfg.fov = v; if(cam){cam.fov=v; cam.updateProjectionMatrix();} }},
    'sens-slider': { key: 'fs_sens', label: 'sens-label', text: 'Sensi: ', cb: v => cfg.sens = v },
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

export function initSettings(gameCam) {
    Object.keys(uiMap).forEach(id => {
        const el = document.getElementById(id);
        const item = uiMap[id];
        const val = localStorage.getItem(item.key) || el.value;
        
        const apply = (v) => {
            localStorage.setItem(item.key, v);
            document.getElementById(item.label).innerText = `${item.text}${v}${item.unit || ''}`;
            item.cb(v, gameCam);
        };

        el.value = val;
        apply(val);
        el.oninput = (e) => apply(e.target.value);
    });

    const cc = document.getElementById('cross-color');
    cc.value = cfg.crossColor;
    cc.onchange = (e) => {
        cfg.crossColor = e.target.value;
        document.getElementById('dot').style.backgroundColor = cfg.crossColor;
        localStorage.setItem('fs_cross_color', cfg.crossColor);
    };

    document.getElementById('rank-btn').onclick = (e) => {
        cfg.rank = !cfg.rank;
        localStorage.setItem('fs_rank_hide', !cfg.rank);
        e.target.innerText = cfg.rank ? "RANKING: ON" : "RANKING: OFF";
    };
}