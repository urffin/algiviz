import type { Frame } from "../playback/types.js";

/** Types maps user-defined type names to their data, e.g. { node: NodeData }. */
export type SceneObject<Types extends object> = {
    [K in keyof Types & string]: Readonly<{ id: string; type: K; data: Types[K]; zIndex?: number }>;
}[keyof Types & string];

export interface Scene<Types extends object> {
    readonly objects: readonly SceneObject<Types>[];
}

export interface ObjectTransition<Object> {
    readonly id: string;
    readonly previous: Object | null;
    readonly current: Object | null;
    readonly phase: "update" | "enter" | "exit";
    readonly progress: number;
    /** Suggested opacity/scale for entering and exiting objects. */
    readonly presence: number;
}

export interface SceneFrame<Types extends object, Event> {
    readonly progress: number;
    readonly stepIndex: number;
    readonly event: Event;
    /** Draw order: zIndex, then current snapshot order (removed objects follow). */
    readonly objects: readonly ObjectTransition<SceneObject<Types>>[];
    /** Includes entering/exiting objects, even when their presence is zero. */
    get(id: string): ObjectTransition<SceneObject<Types>> | undefined;
}

export type SceneVisualizations<Types extends object, Context, Event> = {
    readonly [K in keyof Types & string]: (
        context: Context,
        object: ObjectTransition<Extract<SceneObject<Types>, { type: K }>>,
        scene: SceneFrame<Types, Event>
    ) => void;
};

type SceneMatch<Types extends object> = {
    id: string;
    previous: SceneObject<Types> | null;
    current: SceneObject<Types> | null;
    phase: ObjectTransition<SceneObject<Types>>["phase"];
};

type SceneMatchPlan<Types extends object> = {
    ordered: SceneMatch<Types>[];
    positions: Map<string, number>;
};

function validateProgress(progress: number): void {
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
        throw new RangeError("Scene progress must be between zero and one");
    }
}

function indexScene<Types extends object>(scene: Scene<Types>) {
    const result = new Map<string, SceneObject<Types>>();
    for (const object of scene.objects) {
        if (typeof object.id !== "string" || !object.id || typeof object.type !== "string" || !object.type) {
            throw new TypeError("Scene objects require non-empty string ids and types");
        }
        if (!Number.isFinite(object.zIndex ?? 0)) throw new RangeError("zIndex must be finite");
        if (result.has(object.id)) throw new Error(`Duplicate scene object id: ${object.id}`);
        result.set(object.id, object);
    }
    return result;
}

function matchScenes<Types extends object>(previousScene: Scene<Types>, currentScene: Scene<Types>): SceneMatchPlan<Types> {
    const before = indexScene(previousScene), after = indexScene(currentScene);
    const ordered: SceneMatch<Types>[] = [];
    for (const [id, current] of after) {
        const previous = before.get(id) ?? null;
        if (previous && previous.type !== current.type) {
            throw new Error(`Object ${id} changed type; use a new id for a different type`);
        }
        ordered.push({ id, previous, current, phase: previous === null ? "enter" : "update" });
    }
    for (const [id, previous] of before) {
        if (!after.has(id)) ordered.push({ id, previous, current: null, phase: "exit" });
    }
    ordered.sort((a, b) => ((a.current ?? a.previous)!.zIndex ?? 0) - ((b.current ?? b.previous)!.zIndex ?? 0));
    return { ordered, positions: new Map(ordered.map((object, i) => [object.id, i])) };
}

function resolveFrame<Types extends object, Event>(frame: Frame<Scene<Types>, Event>, plan: SceneMatchPlan<Types>): SceneFrame<Types, Event> {
    const progress = frame.progress;
    const objects = Object.freeze(plan.ordered.map(({ id, previous, current, phase }) => Object.freeze({
        id, previous, current, phase, progress,
        presence: phase === "enter" ? progress : phase === "exit" ? 1 - progress : 1
    })));
    // Capture only this plan and this frame's transitions, never mutable renderer state.
    const positions = plan.positions;
    return Object.freeze({
        progress, stepIndex: frame.stepIndex, event: frame.event, objects,
        get(id: string) { const index = positions.get(id); return index === undefined ? undefined : objects[index]; }
    });
}

/** Matches without a cache or intermediate plan; snapshots must be immutable. */
export function createSceneFrame<Types extends object, Event>(
    frame: Frame<Scene<Types>, Event>
): SceneFrame<Types, Event> {
    validateProgress(frame.progress);
    const before = indexScene(frame.previous),
        after = indexScene(frame.current);
    const byId = new Map<string, ObjectTransition<SceneObject<Types>>>();
    for (const id of new Set([...after.keys(), ...before.keys()])) {
        const previous = before.get(id) ?? null,
            current = after.get(id) ?? null;
        if (previous && current && previous.type !== current.type) {
            throw new Error(`Object ${id} changed type; use a new id for a different type`);
        }
        byId.set(
            id,
            Object.freeze({
                id,
                previous,
                current,
                progress: frame.progress,
                phase: previous === null ? "enter" : current === null ? "exit" : "update",
                presence: previous === null ? frame.progress : current === null ? 1 - frame.progress : 1
            })
        );
    }
    const objects = Object.freeze(
        [...byId.values()].sort(
            (a, b) => ((a.current ?? a.previous)!.zIndex ?? 0) - ((b.current ?? b.previous)!.zIndex ?? 0)
        )
    );
    return Object.freeze({
        progress: frame.progress,
        stepIndex: frame.stepIndex,
        event: frame.event,
        objects,
        get: (id: string) => byId.get(id)
    });
}

/** Backend-independent dispatch; retains a matching plan for at most one immutable endpoint pair. */
export function createSceneRenderer<Types extends object, Context, Event = unknown>(
    visualizations: SceneVisualizations<Types, Context, Event>
) {
    const registry = new Map(Object.entries(visualizations));
    let cache: { previous: Scene<Types>; current: Scene<Types>; plan: SceneMatchPlan<Types> } | undefined;
    return Object.freeze({
        render(context: Context, frame: Frame<Scene<Types>, Event>): void {
            validateProgress(frame.progress);
            let plan: SceneMatchPlan<Types>;
            if (cache && cache.previous === frame.previous && cache.current === frame.current) {
                plan = cache.plan;
            } else {
                plan = matchScenes(frame.previous, frame.current);
                // Validate the complete pair before dispatch or cache replacement.
                for (const object of plan.ordered) {
                    const type = (object.current ?? object.previous)!.type;
                    if (typeof registry.get(type) !== "function")
                        throw new Error(`No visualization for scene type: ${type}`);
                }
                cache = { previous: frame.previous, current: frame.current, plan };
            }
            const scene = resolveFrame(frame, plan);
            for (const object of scene.objects) {
                const type = (object.current ?? object.previous)!.type;
                const draw = registry.get(type) as (
                    context: Context,
                    object: ObjectTransition<SceneObject<Types>>,
                    scene: SceneFrame<Types, Event>
                ) => void;
                draw(context, object, scene);
            }
        }
    });
}

/** Projects immutable state endpoints, retaining at most two scenes. */
export function createSceneProjector<State, Types extends object>(project: (state: State) => Scene<Types>) {
    let cache: { state: State; scene: Scene<Types> }[] = [];
    return <Event>(frame: Frame<State, Event>): Frame<Scene<Types>, Event> => {
        const next: typeof cache = [];
        function endpoint(state: State) {
            const found = [...next, ...cache].find(entry => Object.is(entry.state, state));
            const entry = found ?? { state, scene: project(state) };
            if (!next.includes(entry)) next.push(entry);
            return entry.scene;
        }
        const previous = endpoint(frame.previous);
        const current = endpoint(frame.current);
        // Failed projections do not replace the previously successful cache.
        cache = next;
        return Object.freeze({ previous, current, progress: frame.progress, stepIndex: frame.stepIndex, event: frame.event });
    };
}