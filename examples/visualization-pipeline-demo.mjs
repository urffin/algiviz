import { createDemoPlayer } from './demo-player.mjs';
import { stages, pipelineSteps, tokenRenderer } from './visualization-pipeline.mjs';
const $ = id => document.getElementById(id);
const lessons = [
    ['Алгоритм сохраняет два состояния', 'Генератор ещё ничего не рисует. Он сообщает, где круг находится сначала и где должен оказаться.', 'Первое состояние', 'x = 0', 'Следующее состояние', 'x = 100', 'На выходе — два снимка данных. Движения пока нет.'],
    ['Плеер выбирает момент между ними', 'Переход длится 1000 мс. Мы продвигаем плеер на 500 мс — ровно до середины.', 'Прошло / длительность', '500 / 1000 мс', 'Доля перехода', 'progress = 0.5', 'Плеер хранит оба состояния и число 0.5. Координату круга он ещё не вычисляет.'],
    ['Проекция даёт данным визуальный объект', 'Каждый снимок превращается в сцену. Координата становится данными объекта с именем token-1 и типом token.', 'Состояние', '{ x: 100 }', 'Объект сцены', 'id: token-1\ntype: token\ndata: { x: 100 }', 'То же преобразование применяется к x = 0. Теперь есть две сцены с одним и тем же объектом.'],
    ['Renderer узнаёт один и тот же круг', 'Вызов render сравнивает две сцены. Совпадающий id означает, что объект перемещается; type выбирает нашу функцию token.', 'В предыдущей сцене', 'token-1\nx = 0', 'В текущей сцене', 'token-1\nx = 100', 'Обработчик token получает оба объекта и progress = 0.5. Сопоставление библиотека делает сама.'],
    ['Наш обработчик рисует круг', 'Теперь функция token вычисляет координату между 0 и 100 и передаёт её в Canvas.', '', '', '', '', 'Вот где данные впервые превращаются в изображение. Дальше меняется только progress — код остаётся тем же.'],
];
const ranges = [[4,11],[35,42],[13,18],[46,47],[23,31]];
let source = [], lastStage = -1;
const fullLines = [];
function followFullSource(stage) {
    const [start,end] = ranges[stage];
    fullLines.forEach((node,index) => {
        node.style.background = index >= start-1 && index < end ? '#245047' : '';
    });
    const panel = $('source'), target = fullLines[start-1];
    if (!target || !panel.closest('details').open) return;
    const top = target.offsetTop, bottom = fullLines[end-1].offsetTop + fullLines[end-1].offsetHeight;
    if (top < panel.scrollTop || bottom > panel.scrollTop + panel.clientHeight) {
        panel.scrollTo({top:Math.max(0,top-24), behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    }
}
function showSnippet(stage) {
    if (!source.length) return;
    const [start,end] = ranges[stage];
    $('snippet').textContent = source.slice(start-1,end).join('\n');
    followFullSource(stage);
}
fetch('./visualization-pipeline-source.mjs').then(response => {
    if (!response.ok) throw new Error('Не удалось загрузить исходный код');
    return response.text();
}).then(text => {
    source = text.split('\n');
    source.forEach(line=>{
        const node=document.createElement('span'); node.style.display='block';
        node.textContent=line || ' '; $('source').append(node); fullLines.push(node);
    });
    showSnippet(Math.max(0,lastStage));
}).catch(error => { $('snippet').textContent = error.message; });
$('source').closest('details').addEventListener('toggle',()=>followFullSource(Math.max(0,lastStage)));
const result = $('result').getContext('2d');
const playback = createDemoPlayer({source:()=>pipelineSteps(), isTerminal:step=>step.event==='done', render(frame, playbackState) {
    const s = frame.progress < 1 ? frame.previous : frame.current, lesson = lessons[s.stage];
    // Keep the reading surface still between checkpoints: no scrolling or animated code.
    if (lastStage !== s.stage) {
        showSnippet(s.stage); lastStage = s.stage;
        $('detail-title').textContent = lesson[0];
        $('explanation').textContent = lesson[1];
        ['before-label','before-value','after-label','after-value','takeaway'].forEach((id,i)=>{$(id).textContent=lesson[i+2];});
        $('flow').hidden = s.stage === 4; $('drawing').hidden = s.stage !== 4;
        $('code-title').textContent = `Код · ${stages[s.stage][0]}`;
        $('stage-track').textContent = stages.map(([title],i)=>i===s.stage?`[${title}]`:title).join(' → ');
    }
    $('status').textContent = s.stage < 4 ? `Этап ${s.stage+1} из 5 · ${playbackState.running?'автопоказ':'читайте в своём темпе'}` : `Этап 5 из 5 · progress = ${s.progress}`;
    $('play').textContent = playbackState.running ? 'Пауза' : playbackState.finished ? 'Повторить автопоказ' : 'Автопоказ';
    $('data').textContent = JSON.stringify({previous:s.frame.previous,current:s.frame.current,progress:s.progress},null,2);
    if (s.stage === 4) {
        result.clearRect(0,0,600,160); result.font='16px system-ui';result.fillStyle='#aabbd2';result.fillText('0',30,135);result.fillText('100',535,135);
        result.strokeStyle='#405577';result.beginPath();result.moveTo(40,80);result.lineTo(560,80);result.stroke();
        tokenRenderer.render(x=>{result.fillStyle='#b39bff';result.beginPath();result.arc(40+x/100*520,80,18,0,Math.PI*2);result.fill();},s.projected);
        $('formula').textContent=`0 + (100 − 0) × ${s.progress} = ${s.x}`;
    }
},onError:error=>{$('error').textContent=error.message;}});
// This is a reading exercise: preserve shared stepping, slow only automatic playback.
$('speed').replaceChildren(...[[.065,'10 секунд на шаг'],[.13,'5 секунд на шаг'],[.25,'2.6 секунды на шаг']].map(([value,label])=>new Option(label,String(value))));
$('speed').value='0.065';
$('previous').textContent='← Назад'; $('next').textContent='Следующий шаг →'; $('restart').textContent='Сначала';
playback.load();
