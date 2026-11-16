import { Player } from '@grundyjs/algiviz/player';
import { createArrayTrace } from '@grundyjs/algiviz/array';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';

function mount() {
  const container = document.querySelector('#player');
  const canvas = container.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const result = document.querySelector('#result');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  result.textContent = 'Press Start';

  function* minimum(values) {
    const array = createArrayTrace(values);
    result.textContent = 'Searching…';
    yield array.start();
    let min = 0;
    yield array.highlight([min]);
    for (let i = 1; i < array.length; i++) {
      yield array.compare(min, i);
      if (array.at(i).value < array.at(min).value) min = i;
      yield array.highlight([min]);
    }
    result.textContent = 'Minimum: ' + array.at(min).value;
    yield array.done({ result: [min] });
  }

  const renderer = createArrayRenderer({ theme: 'light' });
  const player = new Player(container, {
    viewport: canvas,
    stepSource: () => minimum([7, 3, 5, 2, 6]),
    isTerminal: step => step.event.type === 'done',
    render: frame => renderer.render(ctx, frame),
  });
  return player;
}

mount();
window.addEventListener('pageshow', event => { if (event.persisted) mount(); });
