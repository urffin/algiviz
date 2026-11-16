import { Player } from '@grundyjs/algiviz/player';

function mount() {
    const container = document.querySelector('#player');
    const output = container.querySelector('pre');
    output.textContent = 'Press Start';

    return new Player(container, {
        viewport: output,
        source: function* () {
            yield [3, 1, 2];
            yield [1, 3, 2];
            yield [1, 2, 3];
        },
        render({ current }) {
            output.textContent = JSON.stringify(current);
        },
    });
}

mount();
// Player disposes on pagehide. BFcache restoration starts a new idle session.
window.addEventListener('pageshow', event => { if (event.persisted) mount(); });
