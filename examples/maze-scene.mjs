import {
  createSceneProjector,
  createSceneRenderer,
} from "@grundyjs/algiviz/scene";
export function mazeScene(state) {
  // A whole grid is one application-owned visual object, not an array-sort operation.
  return { objects: [{ id: "maze:grid", type: "maze-grid", data: state }] };
}
export function mazeLayout(width, height, columns, rows) {
  if (
    ![width, height, columns, rows].every(Number.isFinite) ||
    width < 40 ||
    height < 40 ||
    !Number.isInteger(columns) ||
    !Number.isInteger(rows) ||
    columns < 1 ||
    rows < 1
  )
    throw new RangeError("Invalid maze geometry");
  const cell = Math.min((width - 32) / columns, (height - 32) / rows);
  return {
    cell,
    left: (width - columns * cell) / 2,
    top: (height - rows * cell) / 2,
  };
}
export function createMazeRenderer(colors) {
  // Only immutable endpoints are cached; viewport dimensions are read when drawing.
  const project = createSceneProjector(mazeScene);
  const renderer = createSceneRenderer({
    "maze-grid"(ctx, object) {
      const s = object.current?.data;
      if (!s) return;
      const { cell, left, top } = mazeLayout(
        ctx.canvas.width,
        ctx.canvas.height,
        s.width,
        s.height,
      );
      const path = new Set(s.path);
      const snap = (value) => Math.round(value);
      ctx.save();
      for (let id = 0; id < s.walls.length; id++) {
        const x = snap(left + (id % s.width) * cell),
          y = snap(top + Math.floor(id / s.width) * cell);
        const w = snap(left + ((id % s.width) + 1) * cell) - x,
          h = snap(top + (Math.floor(id / s.width) + 1) * cell) - y;
        ctx.fillStyle = path.has(id)
          ? colors.sorted
          : s.status[id] === 2
            ? colors.active
            : s.status[id] === 1
              ? colors.held
              : s.status[id] === 3
                ? colors.finished
                : colors.canvasBackground;
        ctx.globalAlpha = path.has(id) ? 0.65 : s.status[id] ? 0.35 : 1;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        const thickness = Math.min(
          w / 3,
          h / 3,
          Math.max(1, Math.min(3, cell * 0.06)),
        );
        ctx.fillStyle = colors.border;
        if (s.walls[id] & 1) ctx.fillRect(x, y, w, thickness);
        if (s.walls[id] & 2) ctx.fillRect(x + w - thickness, y, thickness, h);
        if (s.walls[id] & 4) ctx.fillRect(x, y + h - thickness, w, thickness);
        if (s.walls[id] & 8) ctx.fillRect(x, y, thickness, h);
        if (
          cell >= 22 &&
          s.kind === "search" &&
          s.method === "bfs" &&
          s.levels[id] >= 0 &&
          !path.has(id)
        ) {
          ctx.fillStyle = colors.text;
          ctx.font = `${Math.min(16, cell * 0.3)}px system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(s.levels[id]), x + w / 2, y + h / 2, w * 0.7);
        }
      }
      if (cell >= 8) {
        const point = (id) => [
          left + ((id % s.width) + 0.5) * cell,
          top + (Math.floor(id / s.width) + 0.5) * cell,
        ];
        if (s.path.length > 1) {
          ctx.strokeStyle = colors.sorted;
          ctx.lineWidth = Math.max(2, cell * 0.15);
          ctx.beginPath();
          s.path.forEach((id, i) => {
            const [x, y] = point(id);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          });
          ctx.stroke();
        }
        for (const id of new Set(
          [s.start, s.target, s.current].filter((v) => v !== null),
        )) {
          const [x, y] = point(id),
            r = Math.min(13, cell * 0.35);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = colors.canvasBackground;
          ctx.fill();
          ctx.strokeStyle = id === s.current ? colors.active : colors.text;
          ctx.lineWidth = 2;
          ctx.stroke();
          const label =
            id === s.start && id === s.target
              ? "S/T"
              : id === s.start
                ? "S"
                : id === s.target
                  ? "T"
                  : "";
          if (cell >= 22 && label) {
            ctx.fillStyle = colors.text;
            ctx.font = "bold 12px system-ui";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, x, y, cell * 0.6);
          }
        }
      }
      ctx.restore();
    },
  });
  return {
    render(ctx, frame) {
      ctx.fillStyle = colors.canvasBackground;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      renderer.render(ctx, project(frame));
    },
  };
}
