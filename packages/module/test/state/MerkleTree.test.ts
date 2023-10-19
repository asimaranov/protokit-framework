import {
  CachedMerkleTreeStore,
  InMemoryMerkleTreeStorage,
  RollupMerkleTree,
} from "@proto-kit/protocol";
import { MockAsyncMerkleTreeStore } from "./MockAsyncMerkleStore";
import { beforeEach } from "@jest/globals";
import { Field, Poseidon } from "o1js";
import { log } from "@proto-kit/common";

describe("cachedMerkleTree", () => {
  let store: MockAsyncMerkleTreeStore;
  let syncStore: InMemoryMerkleTreeStorage;
  let tree: RollupMerkleTree;

  let cached: CachedMerkleTreeStore;
  let cachedTree: RollupMerkleTree;

  beforeEach(async () => {
    log.setLevel("DEBUG");

    store = new MockAsyncMerkleTreeStore();
    syncStore = store.store;
    tree = new RollupMerkleTree(syncStore);

    tree.setLeaf(1n, Field(10));
    tree.setLeaf(3n, Field(30));
    tree.setLeaf(5n, Field(50));

    cached = new CachedMerkleTreeStore(store);
    await cached.preloadKey(1n);
    await cached.preloadKey(3n);
    await cached.preloadKey(5n);
    cachedTree = new RollupMerkleTree(cached);
  });

  it("should have the same root", async () => {
    expect(cached.getNode(1n, 0)).toBe(10n);
    expect(cached.getNode(3n, 0)).toBe(30n);
    expect(cached.getNode(5n, 0)).toBe(50n);
    expect(syncStore.getNode(5n, 0)).toBe(50n);

    expect(cached.getNode(0n, 1)).toBe(
      Poseidon.hash([Field(0), Field(10)]).toBigInt()
    );

    expect(cached.getNode(0n, 254)).toBe(await store.getNode(0n, 254));
    expect(cached.getNode(0n, 254)).toBe(syncStore.getNode(0n, 254));

    expect(cachedTree.getRoot().toBigInt()).toBe(tree.getRoot().toBigInt());
  });

  it("should load the correct root when only loading a subset of keys", async () => {
    await cached.preloadKey(3n);

    const correctRoot = tree.getRoot();
    expect(cachedTree.getRoot().toBigInt()).toBe(correctRoot.toBigInt());
  });

  it("should generate correct witnesses when only loading a subset of keys", async () => {
    await cached.preloadKey(5n);

    const correctRoot = tree.getRoot();
    const witness = tree.getWitness(5n);
    expect(witness.calculateRoot(Field(50)).toBigInt()).toBe(
      correctRoot.toBigInt()
    );
  });

  it("should generate correct witnesses after merging", async () => {
    expect(cachedTree.getRoot().toBigInt()).toBe(tree.getRoot().toBigInt());

    await cached.preloadKey(5n);
    cachedTree.setLeaf(5n, Field(100));

    const correctRoot = cachedTree.getRoot();

    await cached.mergeIntoParent();

    const cached2 = new CachedMerkleTreeStore(store);
    await cached2.preloadKey(1n);
    await cached2.preloadKey(3n);
    await cached2.preloadKey(5n);
    expect(cached2.getNode(1n, 0)).toBe(10n);
    expect(cached2.getNode(3n, 0)).toBe(30n);
    expect(cached2.getNode(5n, 0)).toBe(100n);
    const tree2 = new RollupMerkleTree(cached2);

    const witness = tree2.getWitness(3n);

    expect(witness.calculateRoot(Field(30)).toBigInt()).toBe(
      correctRoot.toBigInt()
    );
  });
});
