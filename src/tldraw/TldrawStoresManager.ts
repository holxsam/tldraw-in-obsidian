import { createTLStore, HistoryEntry, TLRecord, TLStore } from "tldraw";

export type StoreInstanceInfo<T> = {
    instanceId: string,
    sharedId: string,
    syncToMain: boolean,
    data: T,
};

type StoreInstance<T = unknown> = {
    store: TLStore,
    source: StoreInstanceInfo<T>,
    unregister: () => void
};

export type StoreGroup<MainData = unknown, InstanceData = unknown> = {
    /**
     * Contains the "main" store, which should be responsible for persisting data.
     */
    main: MainStore<MainData, InstanceData>,
    /**
     * Theses are instances derived from {@linkcode StoreGroup.main}
     */
    instances: StoreInstance<InstanceData>[],
    /**
     * 
     * @param source The source view
     * @param entry The entry that should be synced to the "main" store.
     * @returns 
     */
    apply: (instanceId: string, entry: HistoryEntry<TLRecord>) => void,
};

export type StoreListenerContext<MainData, InstanceData> = {
    storeGroup: StoreGroup<MainData, InstanceData>,
    removeListener: () => void
};

export type MainStore<MainData, InstanceData> = {
    store: TLStore,
    data: MainData,
    /**
     * This will be called when all instances are removed.
     * @returns 
    */
    dispose: () => void,
    init: (storeGroup: StoreGroup<MainData, InstanceData>) => void,
    storeListener: (
        entry: HistoryEntry<TLRecord>,
        context: StoreListenerContext<MainData, InstanceData>
    ) => void,
}

export type StoreContext<MainData, InstanceData> = {
    storeGroup: StoreGroup<MainData, InstanceData>,
    instance: StoreInstance<InstanceData>
};

export default class TldrawStoresManager<MainData, InstanceData> {
    /**
     * #TODO: Handle the case where keys are renamed.
     */
    private storeGroupMap = new Map<string, StoreGroup<MainData, InstanceData>>();

    /**
     * 
     * @param info
     * @returns An object containing a new {@linkcode TLStore} instance.
     */
    registerInstance(info: StoreInstanceInfo<InstanceData>, createMain: () => MainStore<MainData, InstanceData>): StoreContext<MainData, InstanceData> {
        let storeGroup = this.storeGroupMap.get(info.sharedId);
        if (!storeGroup) {
            const main = createMain();
            const _storeGroup: StoreGroup<MainData, InstanceData> = {
                main,
                instances: [],
                apply: (instanceId, entry) => {
                    // TODO: Find a way to debounce the synchronziation of entry to the other stores.
                    syncToStore(main.store, entry);
                    for (const _instance of _storeGroup.instances) {
                        if (_instance.source.instanceId == instanceId) continue;
                        syncToStore(_instance.store, entry);
                    }
                },
            }
            main.init(_storeGroup);
            this.storeGroupMap.set(info.sharedId, storeGroup = _storeGroup);
            this.listenDocumentStore(_storeGroup);
        }

        const sourceStore = createSourceStore(storeGroup, info.instanceId, info.syncToMain);
        const instance: StoreInstance<InstanceData> = {
            source: info,
            store: sourceStore,
            unregister: () => {
                storeGroup.instances.remove(instance);
                instance.store.dispose();
                if (storeGroup.instances.length === 0) {
                    this.storeGroupMap.delete(info.sharedId);
                    storeGroup.main.store.dispose();
                    storeGroup.main.dispose();
                }
            }
        };
        storeGroup.instances.push(instance);
        return { instance, storeGroup };
    }

    private listenDocumentStore(storeGroup: StoreGroup<MainData, InstanceData>) {
        const removeListener = storeGroup.main.store.listen(
            (entry) => storeGroup.main.storeListener(entry, {
                storeGroup,
                removeListener
            }),
            { scope: 'document' },
        );
    }
}

/**
 * Create a new store that optionally synchronizes modifications to the "main" store.
 * @param source 
 * @param storeGroup Contains the store to synchronize to
 */
function createSourceStore<Group extends StoreGroup>(storeGroup: Group, instanceId: string, syncToMain: boolean): TLStore {
    const snapshot = storeGroup.main.store.getStoreSnapshot();
    const store = createTLStore({
        assets: storeGroup.main.store.props.assets,
        snapshot: snapshot,
    });

    if(syncToMain) {
        store.listen((entry) => storeGroup.apply(instanceId, entry), { scope: 'document' });
    }

    return store;
}

function syncToStore(target: TLStore, entry: HistoryEntry<TLRecord>) {
    // logFn(syncToStore, 'Entry type -', entry.source);
    target.applyDiff(entry.changes);
}
