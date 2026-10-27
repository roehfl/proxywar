import ring6 from "./data/maps/ring6.json";
import type { GameMap, NodeId, NodeType } from "./types";

const MAPS: Record<string, GameMap> = { ring6: ring6 as GameMap };

export function getMap(id: string): GameMap {
  const map = MAPS[id];
  if (!map) throw new Error(`unknown map: ${id}`);
  return map;
}

/** 로캘과 무관한 문자열 비교(정렬을 결정적으로 유지한다). */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function neighbors(map: GameMap, node: NodeId): NodeId[] {
  const out: NodeId[] = [];
  for (const [a, b] of map.edges) {
    if (a === node) out.push(b);
    else if (b === node) out.push(a);
  }
  return out;
}

export function nodeType(map: GameMap, node: NodeId): NodeType {
  const found = map.nodes.find((n) => n.id === node);
  if (!found) throw new Error(`unknown node: ${node}`);
  return found.type;
}

export interface BfsResult {
  dist: Record<NodeId, number>;
  prev: Record<NodeId, NodeId | null>;
}

/** from에서 너비 우선 탐색. passable이 거짓인 거점은 도달은 하되 그 너머로 퍼지지 않는다. */
export function bfs(map: GameMap, from: NodeId, passable: (node: NodeId) => boolean = () => true): BfsResult {
  const dist: Record<NodeId, number> = { [from]: 0 };
  const prev: Record<NodeId, NodeId | null> = { [from]: null };
  const queue: NodeId[] = [from];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node !== from && !passable(node)) continue;
    for (const next of neighbors(map, node).sort(compareText)) {
      if (next in dist) continue;
      dist[next] = dist[node] + 1;
      prev[next] = node;
      queue.push(next);
    }
  }
  return { dist, prev };
}
