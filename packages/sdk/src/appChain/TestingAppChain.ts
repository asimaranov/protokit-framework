import { ModulesConfig } from "@yab/common";
import {
  InMemoryStateService,
  Runtime,
  RuntimeModulesRecord,
} from "@yab/module";
import { ProtocolModulesRecord, VanillaProtocol } from "@yab/protocol";
import {
  PrivateMempool,
  Sequencer,
  LocalTaskWorkerModule,
  NoopBaseLayer,
  BlockProducerModule,
  ManualBlockTrigger,
  TaskQueue,
  LocalTaskQueue,
  SequencerModulesRecord,
  BlockTrigger,
} from "@yab/sequencer";
import { PrivateKey, PublicKey } from "snarkyjs";
import { InMemorySigner } from "../transaction/InMemorySigner";
import { InMemoryTransactionSender } from "../transaction/InMemoryTransactionSender";
import { AppChain, AppChainModulesRecord } from "./AppChain";

// eslint-disable-next-line max-len
// eslint-disable-next-line @shopify/no-fully-static-classes, @typescript-eslint/no-extraneous-class
export class TestingAppChain<
  RuntimeModules extends RuntimeModulesRecord
> extends AppChain<
  RuntimeModules,
  ProtocolModulesRecord,
  SequencerModulesRecord,
  AppChainModulesRecord
> {
  public static fromRuntime<
    RuntimeModules extends RuntimeModulesRecord
  >(definition: {
    modules: RuntimeModules;
    config: ModulesConfig<RuntimeModules>;
  }) {
    const runtime = Runtime.from({
      state: new InMemoryStateService(),

      ...definition,
    });

    const sequencer = Sequencer.from({
      modules: {
        Mempool: PrivateMempool,
        LocalTaskWorkerModule,
        BaseLayer: NoopBaseLayer,
        BlockProducerModule,
        BlockTrigger: ManualBlockTrigger,
      },

      config: {
        BlockTrigger: {},
        Mempool: {},
        BlockProducerModule: {},
        LocalTaskWorkerModule: {},
        BaseLayer: {},
      },
    });

    sequencer.dependencyContainer.register<TaskQueue>("TaskQueue", {
      useValue: new LocalTaskQueue(0),
    });

    return new TestingAppChain({
      runtime,
      sequencer: sequencer as any,
      protocol: VanillaProtocol.create() as any,

      modules: {
        Signer: InMemorySigner,
        TransactionSender: InMemoryTransactionSender,
      },
    });
  }

  public setSigner(signer: PrivateKey) {
    this.configure({
      Signer: {
        signer,
      },

      TransactionSender: {},
    });
  }

  public async produceBlock() {
    const blockTrigger = this.sequencer.resolveOrFail(
      "BlockTrigger",
      ManualBlockTrigger
    );
    await blockTrigger.produceBlock();
  }
}
