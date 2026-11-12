import { Player } from '@grundyjs/algiviz/player';

function mount() {
    const container = document.querySelector('#player');
    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    return new Player(container, {
        viewport: canvas,
        source: function* () {
            for (const x of [40, 200, 360, 560]) yield { x };
        },
        render({ current }) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.arc(current.x, 80, 18, 0, Math.PI * 2);
            ctx.fillStyle = '#b39bff';
            ctx.fill();
        },
    });
}

mount();
// Player disposes on pagehide. BFcache restoration starts a new idle session.
window.addEventListener('pageshow', event => { if (event.persisted) mount(); });
