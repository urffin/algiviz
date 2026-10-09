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

/** Matches stable identities. Data is not cloned: snapshots must be immutable. */
export function createSceneFrame<Types extends object, Event>(
    frame: Frame<Scene<Types>, Event>
): SceneFrame<Types, Event> {
    if (!Number.isFinite(frame.progress) || frame.progress < 0 || frame.progress > 1) {
        throw new RangeError("Scene progress must be between zero and one");
    }
    function index(scene: Scene<Types>) {
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
    const before = index(frame.previous),
        after = index(frame.current);
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

/** Backend-independent dispatch: Context can be Canvas, SVG, DOM or a custom target. */
export function createSceneRenderer<Types extends object, Context, Event = unknown>(
    visualizations: SceneVisualizations<Types, Context, Event>
) {
    const registry = new Map(Object.entries(visualizations));
    return Object.freeze({
        render(context: Context, frame: Frame<Scene<Types>, Event>): void {
            const scene = createSceneFrame(frame);
            // Validate the complete frame before dispatching any visualization.
            for (const object of scene.objects) {
                const type = (object.current ?? object.previous)!.type;
                if (typeof registry.get(type) !== "function")
                    throw new Error(`No visualization for scene type: ${type}`);
            }
            for (const object of scene.objects) {
                const type = (object.current ?? object.previous)!.type;
                // The registry is keyed by the same discriminant checked during matching.
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
