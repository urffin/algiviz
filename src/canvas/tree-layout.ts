import type { TreeInput, TreePosition } from "../tree/types.js";
import { captureTree } from "../tree/validation.js";

export function finite(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError("Tree drawing geometry is not representable");
    return value;
}

/** Iterative postorder / extended in-order. Missing binary children are terminal leaves. */
export function treeLayout(input: TreeInput, horizontalGap: number, levelGap: number): readonly TreePosition[] {
    const { tree } = captureTree(input);
    if (tree.rootId === null) return Object.freeze([]);
    const children = new Map<string, string[]>(), slots = new Map<string, { left?: string; right?: string }>();
    for (const link of tree.links) {
        const list = children.get(link.parentId) ?? [];
        list.push(link.childId); children.set(link.parentId, list);
        if (link.slot !== undefined) {
            const pair = slots.get(link.parentId) ?? {};
            pair[link.slot] = link.childId; slots.set(link.parentId, pair);
        }
    }
    const ranks = new Map<string, number>(), depths = new Map<string, number>();
    let ordinal = 0;
    const pending: { id: string | null; depth: number; visit: boolean }[] = [{ id: tree.rootId, depth: 0, visit: false }];
    while (pending.length) {
        const { id, depth, visit } = pending.pop()!;
        if (id === null) { ordinal++; continue; }
        if (visit) {
            if (tree.kind === "binary") ranks.set(id, ordinal++);
            else {
                const list = children.get(id) ?? [];
                ranks.set(id, list.length ? ranks.get(list[0]!)! / 2 + ranks.get(list[list.length - 1]!)! / 2 : ordinal++);
            }
            continue;
        }
        depths.set(id, depth);
        if (tree.kind === "binary") {
            const pair = slots.get(id);
            // A missing child advances one ordinal, without constructing descendants.
            if (pair?.right !== undefined) pending.push({ id: pair.right, depth: depth + 1, visit: false });
            else pending.push({ id: null, depth: 0, visit: true });
            pending.push({ id, depth, visit: true });
            if (pair?.left !== undefined) pending.push({ id: pair.left, depth: depth + 1, visit: false });
            else ordinal++;
        } else {
            pending.push({ id, depth, visit: true });
            const list = children.get(id) ?? [];
            for (let i = list.length - 1; i >= 0; i--) pending.push({ id: list[i]!, depth: depth + 1, visit: false });
        }
    }
    const rootRank = ranks.get(tree.rootId)!;
    return Object.freeze(tree.nodes.map(node => Object.freeze({ nodeId: node.id,
        x: finite((ranks.get(node.id)! - rootRank) * horizontalGap), y: finite(depths.get(node.id)! * levelGap) })));
}
